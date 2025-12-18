package main

import (
	"bytes"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	"github.com/shirou/gopsutil/v3/cpu"
	"github.com/shirou/gopsutil/v3/disk"
	"github.com/shirou/gopsutil/v3/mem"
)

type Config struct {
	AdminPanelURL string
	VPSID         string
	APIKey        string
	ReportInterval int
}

type StatusReport struct {
	Status       string  `json:"status"`
	CPUUsage     float64 `json:"cpuUsage"`
	MemoryUsage  float64 `json:"memoryUsage"`
	DiskUsage    float64 `json:"diskUsage"`
	Containers   []string `json:"containers"`
}

type DeployRequest struct {
	DeploymentID int               `json:"deploymentId"`
	Name         string            `json:"name"`
	DockerCompose string           `json:"dockerCompose"`
	EnvVars      map[string]string `json:"envVars"`
}

type DeploymentLog struct {
	Level   string `json:"level"`
	Message string `json:"message"`
}

var config Config

func main() {
	configPath := flag.String("config", "/etc/deploy-dashboard-agent/config.json", "Path to config file")
	flag.Parse()

	if err := loadConfig(*configPath); err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}

	log.Printf("Starting deploy-dashboard agent for VPS ID: %s", config.VPSID)
	log.Printf("Admin panel URL: %s", config.AdminPanelURL)

	go startStatusReporter()

	http.HandleFunc("/deploy", handleDeploy)
	http.HandleFunc("/health", handleHealth)

	log.Printf("deploy-dashboard agent API listening on :9090")
	if err := http.ListenAndServe(":9090", nil); err != nil {
		log.Fatalf("Failed to start API server: %v", err)
	}
}

func loadConfig(path string) error {
	data, err := os.ReadFile(path)
	if err != nil {
		return err
	}

	return json.Unmarshal(data, &config)
}

func startStatusReporter() {
	ticker := time.NewTicker(time.Duration(config.ReportInterval) * time.Second)
	defer ticker.Stop()

	for {
		reportStatus()
		<-ticker.C
	}
}

func reportStatus() {
	cpuPercent, _ := cpu.Percent(time.Second, false)
	memInfo, _ := mem.VirtualMemory()
	diskInfo, _ := disk.Usage("/")

	var cpuUsage float64
	if len(cpuPercent) > 0 {
		cpuUsage = cpuPercent[0]
	}

	containers, _ := getDockerContainers()

	status := StatusReport{
		Status:       "online",
		CPUUsage:     cpuUsage,
		MemoryUsage:  memInfo.UsedPercent,
		DiskUsage:    diskInfo.UsedPercent,
		Containers:   containers,
	}

	body, err := json.Marshal(status)
	if err != nil {
		log.Printf("Failed to marshal status: %v", err)
		return
	}

	url := fmt.Sprintf("%s/api/vps/%s/status", config.AdminPanelURL, config.VPSID)
	req, err := http.NewRequest("POST", url, bytes.NewBuffer(body))
	if err != nil {
		log.Printf("Failed to create request: %v", err)
		return
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", config.APIKey))

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		log.Printf("Failed to report status: %v", err)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		log.Printf("Status report failed with code: %d", resp.StatusCode)
	}
}

func getDockerContainers() ([]string, error) {
	cmd := exec.Command("docker", "ps", "--format", "{{.Names}}")
	output, err := cmd.Output()
	if err != nil {
		return nil, err
	}

	lines := strings.Split(strings.TrimSpace(string(output)), "\n")
	if len(lines) == 1 && lines[0] == "" {
		return []string{}, nil
	}

	return lines, nil
}

func handleHealth(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}

func handleDeploy(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	authHeader := r.Header.Get("Authorization")
	if authHeader != fmt.Sprintf("Bearer %s", config.APIKey) {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	var req DeployRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	log.Printf("Received deployment request for: %s", req.Name)

	go func() {
		logs := []DeploymentLog{}

		logs = append(logs, DeploymentLog{Level: "info", Message: "Starting deployment"})
		updateDeploymentStatus(req.DeploymentID, "deploying", logs)

		workDir := filepath.Join("/tmp", fmt.Sprintf("deploy-%d", req.DeploymentID))
		if err := os.MkdirAll(workDir, 0755); err != nil {
			logs = append(logs, DeploymentLog{Level: "error", Message: fmt.Sprintf("Failed to create work directory: %v", err)})
			updateDeploymentStatus(req.DeploymentID, "failed", logs)
			return
		}
		defer os.RemoveAll(workDir)

		composeFile := filepath.Join(workDir, "docker-compose.yml")
		if err := os.WriteFile(composeFile, []byte(req.DockerCompose), 0644); err != nil {
			logs = append(logs, DeploymentLog{Level: "error", Message: fmt.Sprintf("Failed to write compose file: %v", err)})
			updateDeploymentStatus(req.DeploymentID, "failed", logs)
			return
		}

		logs = append(logs, DeploymentLog{Level: "info", Message: "Docker compose file created"})
		updateDeploymentStatus(req.DeploymentID, "deploying", logs)

		envFile := filepath.Join(workDir, ".env")
		if len(req.EnvVars) > 0 {
			var envContent strings.Builder
			for key, value := range req.EnvVars {
				envContent.WriteString(fmt.Sprintf("%s=%s\n", key, value))
			}
			if err := os.WriteFile(envFile, []byte(envContent.String()), 0644); err != nil {
				logs = append(logs, DeploymentLog{Level: "error", Message: fmt.Sprintf("Failed to write env file: %v", err)})
				updateDeploymentStatus(req.DeploymentID, "failed", logs)
				return
			}
			logs = append(logs, DeploymentLog{Level: "info", Message: "Environment variables configured"})
		}

		cmd := exec.Command("docker", "stack", "deploy", "-c", composeFile, req.Name)
		cmd.Dir = workDir

		var stdout, stderr bytes.Buffer
		cmd.Stdout = &stdout
		cmd.Stderr = &stderr

		logs = append(logs, DeploymentLog{Level: "info", Message: fmt.Sprintf("Executing: docker stack deploy -c docker-compose.yml %s", req.Name)})
		updateDeploymentStatus(req.DeploymentID, "deploying", logs)

		if err := cmd.Run(); err != nil {
			logs = append(logs, DeploymentLog{Level: "error", Message: fmt.Sprintf("Deployment failed: %v", err)})
			if stderr.Len() > 0 {
				logs = append(logs, DeploymentLog{Level: "error", Message: stderr.String()})
			}
			updateDeploymentStatus(req.DeploymentID, "failed", logs)
			return
		}

		if stdout.Len() > 0 {
			logs = append(logs, DeploymentLog{Level: "info", Message: stdout.String()})
		}

		logs = append(logs, DeploymentLog{Level: "info", Message: "Deployment completed successfully"})
		updateDeploymentStatus(req.DeploymentID, "deployed", logs)
	}()

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"message": "Deployment initiated",
		"deploymentId": fmt.Sprintf("%d", req.DeploymentID),
	})
}

func updateDeploymentStatus(deploymentID int, status string, logs []DeploymentLog) {
	data := map[string]interface{}{
		"status": status,
		"logs":   logs,
	}

	body, err := json.Marshal(data)
	if err != nil {
		log.Printf("Failed to marshal status update: %v", err)
		return
	}

	url := fmt.Sprintf("%s/api/deployments/%d/status", config.AdminPanelURL, deploymentID)
	req, err := http.NewRequest("POST", url, bytes.NewBuffer(body))
	if err != nil {
		log.Printf("Failed to create status update request: %v", err)
		return
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", config.APIKey))

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		log.Printf("Failed to update deployment status: %v", err)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		log.Printf("Status update failed with code %d: %s", resp.StatusCode, string(bodyBytes))
	}
}
