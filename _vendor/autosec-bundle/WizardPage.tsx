import React, { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import HardeningWizard from "@/components/HardeningWizard";
import { ArrowRight, BookOpen, Zap, Shield, Lock, Code } from "lucide-react";

interface Template {
  id: string;
  name: string;
  description: string;
  difficulty: string;
  estimatedCompletionTime: number;
  steps: number;
}

export default function WizardPage() {
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);

  // Fetch available templates
  const templatesQuery = trpc.wizard.getAvailableTemplates.useQuery();

  const templates = templatesQuery.data?.templates || [];

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case "beginner":
        return "bg-green-100 text-green-800";
      case "intermediate":
        return "bg-yellow-100 text-yellow-800";
      case "advanced":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getDifficultyIcon = (difficulty: string) => {
    switch (difficulty) {
      case "beginner":
        return <BookOpen className="w-4 h-4" />;
      case "intermediate":
        return <Zap className="w-4 h-4" />;
      case "advanced":
        return <Shield className="w-4 h-4" />;
      default:
        return <Code className="w-4 h-4" />;
    }
  };

  if (selectedTemplate) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800">
        <div className="container mx-auto p-4">
          <Button
            variant="outline"
            onClick={() => setSelectedTemplate(null)}
            className="mb-4 bg-white text-slate-900 hover:bg-gray-100"
          >
            ← Back to Templates
          </Button>
          <HardeningWizard templateName={selectedTemplate} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 text-white">
      {/* Header */}
      <div className="container mx-auto px-4 py-12">
        <div className="max-w-3xl mx-auto text-center space-y-4 mb-12">
          <h1 className="text-4xl font-bold">Hardening Wizard</h1>
          <p className="text-xl text-gray-300">
            Step-by-step guidance to implement secure code templates and fortify your automotive
            firmware against attacks
          </p>
          <p className="text-gray-400">
            Each template includes detailed instructions, code snippets, testing procedures, and
            compliance verification
          </p>
        </div>

        {/* Templates Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {templates.map((template: Template) => (
            <Card
              key={template.id}
              className="bg-slate-800 border-slate-700 hover:border-cyan-500 transition cursor-pointer overflow-hidden group"
              onClick={() => setSelectedTemplate(template.id)}
            >
              <div className="p-6 space-y-4">
                {/* Header */}
                <div className="space-y-2">
                  <h3 className="text-lg font-bold text-white group-hover:text-cyan-400 transition">
                    {template.name}
                  </h3>
                  <p className="text-sm text-gray-400">{template.description}</p>
                </div>

                {/* Difficulty Badge */}
                <div className="flex items-center gap-2">
                  <div className={`px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1 ${getDifficultyColor(template.difficulty)}`}>
                    {getDifficultyIcon(template.difficulty)}
                    {template.difficulty.charAt(0).toUpperCase() + template.difficulty.slice(1)}
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-700">
                  <div>
                    <p className="text-xs text-gray-500">Steps</p>
                    <p className="text-lg font-bold text-cyan-400">{template.steps}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Est. Time</p>
                    <p className="text-lg font-bold text-cyan-400">
                      {Math.round(template.estimatedCompletionTime / 60)}h
                    </p>
                  </div>
                </div>

                {/* CTA */}
                <Button
                  className="w-full bg-cyan-600 hover:bg-cyan-700 text-white group-hover:gap-2 transition"
                  onClick={() => setSelectedTemplate(template.id)}
                >
                  Start Wizard
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </Card>
          ))}
        </div>

        {/* Info Section */}
        <div className="max-w-4xl mx-auto mt-16 space-y-8">
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-8 space-y-4">
            <h2 className="text-2xl font-bold text-cyan-400">How the Wizard Works</h2>
            <div className="space-y-4 text-gray-300">
              <div className="flex gap-4">
                <div className="flex-shrink-0">
                  <div className="flex items-center justify-center h-8 w-8 rounded-md bg-cyan-600 text-white">
                    1
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold text-white mb-1">Select a Template</h3>
                  <p>Choose a security hardening template that matches your needs</p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-shrink-0">
                  <div className="flex items-center justify-center h-8 w-8 rounded-md bg-cyan-600 text-white">
                    2
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold text-white mb-1">Follow Step-by-Step Instructions</h3>
                  <p>Each step includes detailed instructions, code snippets, and best practices</p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-shrink-0">
                  <div className="flex items-center justify-center h-8 w-8 rounded-md bg-cyan-600 text-white">
                    3
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold text-white mb-1">Run Validation Tests</h3>
                  <p>Execute testing procedures to verify your implementation is correct</p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex-shrink-0">
                  <div className="flex items-center justify-center h-8 w-8 rounded-md bg-cyan-600 text-white">
                    4
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold text-white mb-1">Generate Compliance Report</h3>
                  <p>
                    Get a comprehensive report verifying compliance with ISO/SAE 21434 and AUTOSAR
                    standards
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Benefits */}
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-8 space-y-4">
            <h2 className="text-2xl font-bold text-cyan-400">Benefits</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-gray-300">
              <div className="flex gap-3">
                <Lock className="w-5 h-5 text-cyan-400 flex-shrink-0 mt-1" />
                <div>
                  <p className="font-semibold text-white">Security Hardening</p>
                  <p className="text-sm">Implement proven security patterns</p>
                </div>
              </div>

              <div className="flex gap-3">
                <Shield className="w-5 h-5 text-cyan-400 flex-shrink-0 mt-1" />
                <div>
                  <p className="font-semibold text-white">Compliance Ready</p>
                  <p className="text-sm">Meet ISO/SAE 21434 requirements</p>
                </div>
              </div>

              <div className="flex gap-3">
                <Code className="w-5 h-5 text-cyan-400 flex-shrink-0 mt-1" />
                <div>
                  <p className="font-semibold text-white">Production Code</p>
                  <p className="text-sm">Ready-to-use code templates</p>
                </div>
              </div>

              <div className="flex gap-3">
                <Zap className="w-5 h-5 text-cyan-400 flex-shrink-0 mt-1" />
                <div>
                  <p className="font-semibold text-white">Guided Learning</p>
                  <p className="text-sm">Understand security principles</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
