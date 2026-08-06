import React, { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertCircle,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Code,
  FileText,
  Zap,
  BookOpen,
} from "lucide-react";
import { Streamdown } from "streamdown";

interface WizardStep {
  id: string;
  stepNumber: number;
  title: string;
  description: string;
  estimatedTime: number;
  resources: Array<{
    title: string;
    url: string;
    type: string;
  }>;
}

interface StepDetails {
  id: string;
  stepNumber: number;
  title: string;
  description: string;
  instructions: string[];
  codeSnippet: string;
  testingProcedure: {
    title: string;
    steps: string[];
    expectedOutput: string;
    commonIssues: Array<{
      issue: string;
      solution: string;
    }>;
  };
  validationChecks: Array<{
    id: string;
    name: string;
    description: string;
    checkFunction: string;
    successCriteria: string;
  }>;
  resources: Array<{
    title: string;
    url: string;
    type: string;
  }>;
  estimatedTime: number;
}

interface HardeningWizardProps {
  templateName: string;
}

export const HardeningWizard: React.FC<HardeningWizardProps> = ({ templateName }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [testResults, setTestResults] = useState<
    Array<{ stepId: string; passed: boolean; details?: string }>
  >([]);
  const [stepDetails, setStepDetails] = useState<StepDetails | null>(null);
  const [showCodeEditor, setShowCodeEditor] = useState(false);
  const [codeContent, setCodeContent] = useState("");

  // Fetch wizard steps
  const stepsQuery = trpc.wizard.getSteps.useQuery({ templateName });

  // Fetch step details
  const stepDetailsQuery = trpc.wizard.getStepDetails.useQuery(
    {
      stepId: stepsQuery.data?.steps[currentStep]?.id || "",
      templateName,
    },
    {
      enabled: !!stepsQuery.data?.steps[currentStep],
    }
  );

  // Fetch progress
  const progressQuery = trpc.wizard.getProgress.useQuery({ templateName });

  // Complete step mutation
  const completeStepMutation = trpc.wizard.completeStep.useMutation();

  // Generate report mutation
  const generateReportMutation = trpc.wizard.generateReport.useMutation();

  // Save draft mutation
  const saveDraftMutation = trpc.wizard.saveDraft.useMutation();

  useEffect(() => {
    if (stepDetailsQuery.data?.step) {
      setStepDetails(stepDetailsQuery.data.step);
      setCodeContent(stepDetailsQuery.data.step.codeSnippet);
    }
  }, [stepDetailsQuery.data]);

  const steps = stepsQuery.data?.steps || [];
  const totalSteps = stepsQuery.data?.totalSteps || 0;
  const progressPercentage = totalSteps > 0 ? (completedSteps.length / totalSteps) * 100 : 0;

  const handleNextStep = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePreviousStep = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleCompleteStep = async () => {
    if (!steps[currentStep]) return;

    const allTestsPassed = testResults.every((r) => r.passed);

    try {
      await completeStepMutation.mutateAsync({
        templateName,
        stepId: steps[currentStep].id,
        testResults: testResults.map((r) => ({
          checkId: r.stepId,
          passed: r.passed,
          details: r.details || "",
        })),
      });

      if (allTestsPassed) {
        setCompletedSteps([...completedSteps, currentStep]);
        handleNextStep();
      }
    } catch (error) {
      console.error("Error completing step:", error);
    }
  };

  const handleSaveDraft = async () => {
    if (!steps[currentStep]) return;

    try {
      await saveDraftMutation.mutateAsync({
        templateName,
        stepId: steps[currentStep].id,
        draftContent: codeContent,
      });
    } catch (error) {
      console.error("Error saving draft:", error);
    }
  };

  const handleGenerateReport = async () => {
    try {
      await generateReportMutation.mutateAsync({
        templateName,
        testResults,
      });
    } catch (error) {
      console.error("Error generating report:", error);
    }
  };

  const handleTestValidation = (stepId: string, passed: boolean) => {
    setTestResults((prev) => {
      const existing = prev.find((r) => r.stepId === stepId);
      if (existing) {
        return prev.map((r) => (r.stepId === stepId ? { ...r, passed } : r));
      }
      return [...prev, { stepId, passed }];
    });
  };

  if (stepsQuery.isLoading) {
    return <div className="p-4">Loading wizard...</div>;
  }

  if (!stepDetails) {
    return <div className="p-4">Loading step details...</div>;
  }

  return (
    <div className="w-full max-w-6xl mx-auto p-4 space-y-6">
      {/* Header */}
      <div className="space-y-4">
        <h1 className="text-3xl font-bold">{templateName.replace(/_/g, " ")}</h1>
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>
              Step {currentStep + 1} of {totalSteps}
            </span>
            <span>{Math.round(progressPercentage)}% Complete</span>
          </div>
          <Progress value={progressPercentage} className="h-2" />
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Step Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Step Title and Description */}
          <Card className="p-6 space-y-4">
            <div className="space-y-2">
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <span className="bg-cyan-500 text-white rounded-full w-8 h-8 flex items-center justify-center text-sm">
                  {stepDetails.stepNumber}
                </span>
                {stepDetails.title}
              </h2>
              <p className="text-gray-600">{stepDetails.description}</p>
              <p className="text-sm text-gray-500">
                ⏱️ Estimated time: {stepDetails.estimatedTime} minutes
              </p>
            </div>
          </Card>

          {/* Tabs for Instructions, Code, Testing */}
          <Tabs defaultValue="instructions" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="instructions" className="flex items-center gap-2">
                <BookOpen className="w-4 h-4" />
                <span className="hidden sm:inline">Instructions</span>
              </TabsTrigger>
              <TabsTrigger value="code" className="flex items-center gap-2">
                <Code className="w-4 h-4" />
                <span className="hidden sm:inline">Code</span>
              </TabsTrigger>
              <TabsTrigger value="testing" className="flex items-center gap-2">
                <Zap className="w-4 h-4" />
                <span className="hidden sm:inline">Testing</span>
              </TabsTrigger>
              <TabsTrigger value="resources" className="flex items-center gap-2">
                <FileText className="w-4 h-4" />
                <span className="hidden sm:inline">Resources</span>
              </TabsTrigger>
            </TabsList>

            {/* Instructions Tab */}
            <TabsContent value="instructions" className="space-y-4">
              <Card className="p-6 space-y-4">
                <h3 className="font-semibold text-lg">Step Instructions</h3>
                <ol className="space-y-3 list-decimal list-inside">
                  {stepDetails.instructions.map((instruction, idx) => (
                    <li key={idx} className="text-gray-700">
                      {instruction}
                    </li>
                  ))}
                </ol>
              </Card>
            </TabsContent>

            {/* Code Tab */}
            <TabsContent value="code" className="space-y-4">
              <Card className="p-6 space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="font-semibold text-lg">Code Snippet</h3>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowCodeEditor(!showCodeEditor)}
                  >
                    {showCodeEditor ? "View Only" : "Edit"}
                  </Button>
                </div>

                {showCodeEditor ? (
                  <div className="space-y-2">
                    <textarea
                      value={codeContent}
                      onChange={(e) => setCodeContent(e.target.value)}
                      className="w-full h-64 p-4 border rounded font-mono text-sm bg-gray-50"
                    />
                    <div className="flex gap-2">
                      <Button onClick={handleSaveDraft} variant="default" size="sm">
                        Save Draft
                      </Button>
                      <Button
                        onClick={() => setCodeContent(stepDetails.codeSnippet)}
                        variant="outline"
                        size="sm"
                      >
                        Reset
                      </Button>
                    </div>
                  </div>
                ) : (
                  <pre className="bg-gray-900 text-gray-100 p-4 rounded overflow-x-auto text-sm">
                    <code>{codeContent}</code>
                  </pre>
                )}
              </Card>
            </TabsContent>

            {/* Testing Tab */}
            <TabsContent value="testing" className="space-y-4">
              <Card className="p-6 space-y-6">
                <div>
                  <h3 className="font-semibold text-lg mb-4">Testing Procedure</h3>
                  <div className="bg-blue-50 border border-blue-200 rounded p-4 mb-4">
                    <p className="font-semibold text-blue-900 mb-2">
                      {stepDetails.testingProcedure.title}
                    </p>
                    <ol className="space-y-2 list-decimal list-inside text-sm text-blue-800">
                      {stepDetails.testingProcedure.steps.map((step, idx) => (
                        <li key={idx}>{step}</li>
                      ))}
                    </ol>
                  </div>

                  <div className="bg-green-50 border border-green-200 rounded p-4 mb-4">
                    <p className="font-semibold text-green-900">Expected Output:</p>
                    <p className="text-green-800">{stepDetails.testingProcedure.expectedOutput}</p>
                  </div>

                  {stepDetails.testingProcedure.commonIssues.length > 0 && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded p-4">
                      <p className="font-semibold text-yellow-900 mb-3">Common Issues:</p>
                      <div className="space-y-3">
                        {stepDetails.testingProcedure.commonIssues.map((issue, idx) => (
                          <div key={idx} className="text-sm">
                            <p className="font-semibold text-yellow-800">Issue: {issue.issue}</p>
                            <p className="text-yellow-700">Solution: {issue.solution}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Validation Checks */}
                <div className="space-y-4">
                  <h4 className="font-semibold">Validation Checks</h4>
                  {stepDetails.validationChecks.map((check) => (
                    <Card key={check.id} className="p-4 border-l-4 border-l-cyan-500">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="font-semibold">{check.name}</p>
                          <p className="text-sm text-gray-600 mb-2">{check.description}</p>
                          <p className="text-sm text-gray-600">
                            <strong>Success Criteria:</strong> {check.successCriteria}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleTestValidation(check.id, true)}
                            className={
                              testResults.find((r) => r.stepId === check.id)?.passed
                                ? "bg-green-100"
                                : ""
                            }
                          >
                            <CheckCircle className="w-4 h-4 mr-1" />
                            Pass
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleTestValidation(check.id, false)}
                            className={
                              testResults.find((r) => r.stepId === check.id)?.passed === false
                                ? "bg-red-100"
                                : ""
                            }
                          >
                            <AlertCircle className="w-4 h-4 mr-1" />
                            Fail
                          </Button>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </Card>
            </TabsContent>

            {/* Resources Tab */}
            <TabsContent value="resources" className="space-y-4">
              <Card className="p-6 space-y-4">
                <h3 className="font-semibold text-lg">Resources</h3>
                <div className="space-y-3">
                  {stepDetails.resources.map((resource, idx) => (
                    <a
                      key={idx}
                      href={resource.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block p-3 border rounded hover:bg-gray-50 transition"
                    >
                      <p className="font-semibold text-cyan-600">{resource.title}</p>
                      <p className="text-sm text-gray-600">Type: {resource.type}</p>
                    </a>
                  ))}
                </div>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Right: Sidebar */}
        <div className="space-y-4">
          {/* Progress Summary */}
          <Card className="p-4 space-y-3">
            <h3 className="font-semibold">Progress</h3>
            <div className="text-2xl font-bold text-cyan-600">{Math.round(progressPercentage)}%</div>
            <p className="text-sm text-gray-600">
              {completedSteps.length} of {totalSteps} steps completed
            </p>
          </Card>

          {/* Steps List */}
          <Card className="p-4 space-y-2">
            <h3 className="font-semibold mb-3">Steps</h3>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {steps.map((step, idx) => (
                <button
                  key={step.id}
                  onClick={() => setCurrentStep(idx)}
                  className={`w-full text-left p-2 rounded transition ${
                    idx === currentStep
                      ? "bg-cyan-100 border-l-4 border-l-cyan-500"
                      : completedSteps.includes(idx)
                        ? "bg-green-50"
                        : "hover:bg-gray-50"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {completedSteps.includes(idx) ? (
                      <CheckCircle className="w-4 h-4 text-green-600" />
                    ) : (
                      <div className="w-4 h-4 rounded-full border border-gray-300" />
                    )}
                    <span className="text-sm font-medium">Step {idx + 1}</span>
                  </div>
                  <p className="text-xs text-gray-600 ml-6">{step.title}</p>
                </button>
              ))}
            </div>
          </Card>

          {/* Action Buttons */}
          <div className="space-y-2">
            <Button
              onClick={handleCompleteStep}
              disabled={testResults.some((r) => !r.passed)}
              className="w-full"
            >
              {completedSteps.includes(currentStep) ? "Step Completed ✓" : "Complete Step"}
            </Button>

            {completedSteps.length === totalSteps && (
              <Button onClick={handleGenerateReport} variant="default" className="w-full">
                Generate Report
              </Button>
            )}
          </div>

          {/* Navigation */}
          <div className="flex gap-2">
            <Button
              onClick={handlePreviousStep}
              disabled={currentStep === 0}
              variant="outline"
              className="flex-1"
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Previous
            </Button>
            <Button
              onClick={handleNextStep}
              disabled={currentStep === steps.length - 1}
              variant="outline"
              className="flex-1"
            >
              Next
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HardeningWizard;
