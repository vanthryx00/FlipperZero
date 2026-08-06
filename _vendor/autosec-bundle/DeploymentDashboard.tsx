import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertCircle, CheckCircle, Clock, Zap, Download, Upload } from "lucide-react";
import { toast } from "sonner";

export function DeploymentDashboard() {
  const [autoDeployType, setAutoDeployType] = useState<"flipper_zero" | "esp32" | "both">(
    "both"
  );
  const [isAutoDeploying, setIsAutoDeploying] = useState(false);

  // Queries
  const devicesQuery = trpc.deployment.getDevices.useQuery(undefined, {
    refetchInterval: 5000,
  });

  const buildJobsQuery = trpc.deployment.getAllBuildJobs.useQuery(undefined, {
    refetchInterval: 3000,
  });

  const deploymentJobsQuery = trpc.deployment.getAllDeploymentJobs.useQuery(undefined, {
    refetchInterval: 3000,
  });

  const devicesReadyQuery = trpc.deployment.areDevicesReady.useQuery(undefined, {
    refetchInterval: 5000,
  });

  // Mutations
  const startDiscoveryMutation = trpc.deployment.startDiscovery.useMutation({
    onSuccess: () => {
      toast.success("Device discovery started");
    },
    onError: (error) => {
      toast.error(`Discovery failed: ${error.message}`);
    },
  });

  const automatedDeployMutation = trpc.deployment.automatedDeploy.useMutation({
    onSuccess: (result) => {
      setIsAutoDeploying(false);
      if ("error" in result && result.error) {
        toast.error(`Deployment failed: ${result.error}`);
      } else {
        toast.success("Automated deployment completed successfully!");
      }
    },
    onError: (error) => {
      setIsAutoDeploying(false);
      toast.error(`Deployment error: ${error.message}`);
    },
  });

  // Start discovery on mount
  useEffect(() => {
    startDiscoveryMutation.mutate();
  }, []);

  const devices = devicesQuery.data || [];
  const buildJobs = buildJobsQuery.data || [];
  const deploymentJobs = deploymentJobsQuery.data || [];
  const devicesReady = devicesReadyQuery.data?.ready || false;

  const handleAutomatedDeploy = async () => {
    setIsAutoDeploying(true);
    automatedDeployMutation.mutate({ buildType: autoDeployType });
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">Automated Deployment System</h1>
        <p className="text-gray-600">
          Auto-discover, build, and deploy firmware to Flipper Zero and ESP32 devices
        </p>
      </div>

      {/* Device Status */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Device Status</h2>
          <div className="flex gap-2">
            <Button
              onClick={() => startDiscoveryMutation.mutate()}
              disabled={startDiscoveryMutation.isPending}
              variant="outline"
            >
              <Zap className="w-4 h-4 mr-2" />
              Scan Devices
            </Button>
          </div>
        </div>

        {devices.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <AlertCircle className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>No devices detected. Plug in your Flipper Zero and/or ESP32.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {devices.map((device) => (
              <div
                key={device.id}
                className="border rounded-lg p-4 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">{device.name}</h3>
                  <div className="flex items-center gap-2">
                    {device.status === "ready" ? (
                      <CheckCircle className="w-5 h-5 text-green-500" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-yellow-500" />
                    )}
                    <span className="text-sm font-medium capitalize">{device.status}</span>
                  </div>
                </div>
                <p className="text-sm text-gray-600">Port: {device.port}</p>
                <p className="text-sm text-gray-600">
                  Verified: {device.isVerified ? "Yes" : "No"}
                </p>
                {device.verificationDetails && (
                  <div className="text-sm text-gray-600 space-y-1">
                    <p>
                      Tools: {device.verificationDetails.hasRequiredTools ? "✓" : "✗"}
                    </p>
                    <p>
                      Storage: {(device.verificationDetails.storageAvailable / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Overall Status */}
        <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <div className="flex items-center gap-2">
            {devicesReady ? (
              <CheckCircle className="w-5 h-5 text-green-500" />
            ) : (
              <AlertCircle className="w-5 h-5 text-yellow-500" />
            )}
            <span className="font-semibold">
              {devicesReady ? "All devices ready for deployment" : "Waiting for devices..."}
            </span>
          </div>
        </div>
      </Card>

      {/* Automated Deployment */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">One-Click Deployment</h2>
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-2">
            {(["flipper_zero", "esp32", "both"] as const).map((type) => (
              <button
                key={type}
                onClick={() => setAutoDeployType(type)}
                className={`p-3 rounded-lg border-2 transition ${
                  autoDeployType === type
                    ? "border-blue-500 bg-blue-50"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <div className="font-semibold capitalize">
                  {type === "both" ? "Both Devices" : type.replace("_", " ")}
                </div>
              </button>
            ))}
          </div>

          <Button
            onClick={handleAutomatedDeploy}
            disabled={isAutoDeploying || !devicesReady || automatedDeployMutation.isPending}
            className="w-full bg-green-600 hover:bg-green-700"
            size="lg"
          >
            <Upload className="w-4 h-4 mr-2" />
            {isAutoDeploying ? "Deploying..." : "Start Automated Deployment"}
          </Button>

          <p className="text-sm text-gray-600">
            This will: discover devices → build firmware → deploy to all devices
          </p>
        </div>
      </Card>

      {/* Build Jobs */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">Build Jobs</h2>
        {buildJobs.length === 0 ? (
          <p className="text-gray-500 text-center py-4">No build jobs yet</p>
        ) : (
          <div className="space-y-3">
            {buildJobs.map((job) => (
              <div key={job.id} className="border rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold capitalize">{job.deviceType.replace("_", " ")}</p>
                    <p className="text-sm text-gray-600">{job.id}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {job.status === "completed" && (
                      <CheckCircle className="w-5 h-5 text-green-500" />
                    )}
                    {job.status === "building" && (
                      <Clock className="w-5 h-5 text-blue-500 animate-spin" />
                    )}
                    {job.status === "failed" && (
                      <AlertCircle className="w-5 h-5 text-red-500" />
                    )}
                    <span className="text-sm font-medium capitalize">{job.status}</span>
                  </div>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-500 h-2 rounded-full transition-all"
                    style={{ width: `${job.progress}%` }}
                  />
                </div>
                <p className="text-xs text-gray-600">{job.progress}% complete</p>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Deployment Jobs */}
      <Card className="p-6">
        <h2 className="text-xl font-semibold mb-4">Deployment Jobs</h2>
        {deploymentJobs.length === 0 ? (
          <p className="text-gray-500 text-center py-4">No deployment jobs yet</p>
        ) : (
          <div className="space-y-3">
            {deploymentJobs.map((job) => (
              <div key={job.id} className="border rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold capitalize">{job.deviceType.replace("_", " ")}</p>
                    <p className="text-sm text-gray-600">{job.deviceId}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {job.status === "completed" && (
                      <CheckCircle className="w-5 h-5 text-green-500" />
                    )}
                    {["connecting", "uploading", "verifying"].includes(job.status) && (
                      <Clock className="w-5 h-5 text-blue-500 animate-spin" />
                    )}
                    {job.status === "failed" && (
                      <AlertCircle className="w-5 h-5 text-red-500" />
                    )}
                    <span className="text-sm font-medium capitalize">{job.status}</span>
                  </div>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-green-500 h-2 rounded-full transition-all"
                    style={{ width: `${job.progress}%` }}
                  />
                </div>
                <p className="text-xs text-gray-600">{job.progress}% complete</p>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
