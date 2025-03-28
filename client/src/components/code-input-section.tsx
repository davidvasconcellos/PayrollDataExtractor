import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface TemplateType {
  id: number;
  name: string;
  codes: string;
}

interface PayrollCode {
  code: string;
  description: string;
  category: 'PROVENTOS' | 'DESCONTOS' | 'OUTROS';
}

interface PayrollModel {
  name: string;
  description: string;
  codes: string[];
}

interface CodeInputSectionProps {
  codes: string;
  setCodes: (codes: string) => void;
  templates: TemplateType[];
  onTemplateSelect: (template: TemplateType) => void;
}

interface CodeViewState {
  selectedCodes: string[];
  viewMode: 'card' | 'list';
  searchTerm: string;
  selectedModel: string;
}

import * as React from 'react';
import { useState } from 'react';

export default function CodeInputSection({
  codes,
  setCodes,
  templates,
  onTemplateSelect
}: CodeInputSectionProps) {
  const [state, setState] = useState<CodeViewState>({
    selectedCodes: codes.split(/[\s,]+/).filter(Boolean),
    viewMode: 'card',
    searchTerm: '',
    selectedModel: ''
  });
  // Fetch pre-defined codes and models
  const { data: predefinedCodes } = useQuery<PayrollCode[]>({
    queryKey: ['/api/predefined-codes'],
  });

  const { data: predefinedModels } = useQuery<PayrollModel[]>({
    queryKey: ['/api/predefined-models'],
  });

  const handleTemplateChange = (templateId: string) => {
    const selectedTemplate = templates.find(t => t.id.toString() === templateId);
    if (selectedTemplate) {
      onTemplateSelect(selectedTemplate);
    }
  };

  const handleModelSelect = (modelName: string) => {
    const selectedModel = predefinedModels?.find(m => m.name === modelName);
    if (selectedModel) {
      setCodes(selectedModel.codes.join(', '));
    }
  };

  const handleCodeSelect = (code: string) => {
    setState(prev => {
      const newSelectedCodes = prev.selectedCodes.includes(code)
        ? prev.selectedCodes.filter(c => c !== code)
        : [...prev.selectedCodes, code];
      
      setCodes(newSelectedCodes.join(', '));
      return { ...prev, selectedCodes: newSelectedCodes };
    });
  };

  return (
    <section className="mb-8">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Códigos das Verbas</CardTitle>
              <CardDescription>
                Selecione verbas pré-definidas, um modelo de cargo ou digite manualmente os códigos.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">Lista</span>
              <button
                onClick={() => setState(prev => ({ ...prev, viewMode: prev.viewMode === 'card' ? 'list' : 'card' }))}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                  state.viewMode === 'card' ? 'bg-primary' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    state.viewMode === 'card' ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
              <span className="text-sm text-gray-500">Cards</span>
            </div>
          </div>
          <div className="mt-4">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Pesquisar funções..."
                className="flex-1 rounded-md border px-3 py-2 text-sm"
                value={state.searchTerm}
                onChange={(e) => setState(prev => ({ ...prev, searchTerm: e.target.value }))}
              />
              <select
                value={state.selectedModel}
                onChange={(e) => {
                  const modelName = e.target.value;
                  setState(prev => ({ ...prev, selectedModel: modelName }));
                  if (modelName) handleModelSelect(modelName);
                }}
                className="rounded-md border px-3 py-2 text-sm"
              >
                <option value="">Selecione uma função</option>
                {predefinedModels?.map(model => (
                  <option key={model.name} value={model.name}>
                    {model.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="predefined">
            <TabsList className="mb-4">
              <TabsTrigger value="predefined">Verbas Pré-definidas</TabsTrigger>
              <TabsTrigger value="models">Modelos de Cargo</TabsTrigger>
              <TabsTrigger value="templates">Templates Salvos</TabsTrigger>
              <TabsTrigger value="manual">Entrada Manual</TabsTrigger>
            </TabsList>

            <TabsContent value="predefined">
              <div className="space-y-4">
                {['PROVENTOS', 'DESCONTOS', 'OUTROS'].map((category) => (
                  <div key={category}>
                    <h3 className="text-sm font-medium mb-2">{category}</h3>
                    {state.viewMode === 'card' ? (
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                        {predefinedCodes
                          ?.filter(code => {
                            const matchesSearch = !state.searchTerm || 
                              code.description.toLowerCase().includes(state.searchTerm.toLowerCase());
                            const matchesCategory = code.category === category;
                            return matchesSearch && matchesCategory;
                          })
                          .map(code => (
                            <button
                              key={code.code}
                              onClick={() => handleCodeSelect(code.code)}
                              className={`text-left px-3 py-2 text-sm rounded-md border hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-all ${
                                state.selectedCodes.includes(code.code) ? 'border-blue-500 ring-2 ring-blue-500' : ''
                              }`}
                            >
                              <span className="font-mono text-xs text-gray-500">{code.code}</span>
                              <br />
                              {code.description}
                            </button>
                          ))}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {predefinedCodes
                          ?.filter(code => {
                            const matchesSearch = !state.searchTerm || 
                              code.description.toLowerCase().includes(state.searchTerm.toLowerCase());
                            const matchesCategory = code.category === category;
                            return matchesSearch && matchesCategory;
                          })
                          .map(code => (
                            <div
                              key={code.code}
                              className={`flex items-center justify-between p-2 rounded-md border hover:bg-gray-50 transition-all ${
                                state.selectedCodes.includes(code.code) ? 'border-blue-500 ring-2 ring-blue-500' : ''
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-xs text-gray-500">{code.code}</span>
                                <span>{code.description}</span>
                              </div>
                              <button
                                onClick={() => handleCodeSelect(code.code)}
                                className="px-3 py-1 text-sm rounded-md bg-gray-100 hover:bg-gray-200"
                              >
                                {state.selectedCodes.includes(code.code) ? 'Remover' : 'Adicionar'}
                              </button>
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="models">
              <div className="space-y-4">
                <Select onValueChange={handleModelSelect}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um modelo de cargo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {predefinedModels?.map((model) => (
                        <SelectItem key={model.name} value={model.name}>
                          {model.name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
            </TabsContent>

            <TabsContent value="templates">
              <div className="space-y-4">
                <Select onValueChange={handleTemplateChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um template" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {templates.map((template) => (
                        <SelectItem key={template.id} value={template.id.toString()}>
                          {template.name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
            </TabsContent>

            <TabsContent value="manual">
              <div className="space-y-4">
                <div>
                  <Label htmlFor="verbaCodes">Códigos das Verbas</Label>
                  <Textarea
                    id="verbaCodes"
                    rows={3}
                    placeholder="0002, 0160, 0146"
                    value={codes}
                    onChange={(e) => setCodes(e.target.value)}
                    className="mt-1 font-mono"
                  />
                  <p className="mt-2 text-sm text-gray-500">
                    Digite os códigos separados por vírgula ou espaço.
                  </p>
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <div className="mt-4">
            <Label>Códigos Selecionados</Label>
            <div className="mt-2 p-3 bg-gray-50 rounded-md">
              <p className="font-mono text-sm">
                {codes || <span className="text-gray-400">Nenhum código selecionado</span>}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </section>
  );
};