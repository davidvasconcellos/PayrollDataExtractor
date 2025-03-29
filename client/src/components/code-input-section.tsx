import { Card, CardHeader, CardContent, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import * as React from 'react';
import { useState } from 'react';
import { ChevronDown, ChevronUp, List, LayoutGrid } from 'lucide-react';


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
  isCollapsed: {[key:string]:boolean};
}


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
    selectedModel: '',
    isCollapsed: {'PROVENTOS': true, 'DESCONTOS': true, 'OUTROS': true}
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

  const normalizeCode = (code: string): string[] => {
    return code.split(/[,\s]+/).map(c => c.trim()).filter(Boolean);
  };

  const handleModelSelect = (modelName: string) => {
    const selectedModel = predefinedModels?.find(m => m.name === modelName);
    if (selectedModel && Array.isArray(selectedModel.codes)) {
      const normalizedCodes = selectedModel.codes.flatMap(normalizeCode);
      setState(prev => ({ ...prev, selectedCodes: normalizedCodes }));
      setCodes(normalizedCodes.join(', '));
    }
  };

  const isCodeSelected = (code: string): boolean => {
    const normalizedInputCodes = normalizeCode(code);
    return normalizedInputCodes.some(c => state.selectedCodes.includes(c));
  };

  const handleCodeSelect = (code: string) => {
    const codeGroup = predefinedCodes?.find(pc => 
      normalizeCode(pc.code).some(c => normalizeCode(code).includes(c))
    );

    if (!codeGroup) return;

    const groupCodes = normalizeCode(codeGroup.code);

    setState(prev => {
      const isSelected = groupCodes.some(c => prev.selectedCodes.includes(c));

      if (isSelected) {
        if (confirm("Deseja remover esta verba da função?")) {
          const newSelectedCodes = prev.selectedCodes.filter(c => !groupCodes.includes(c));
          setCodes(newSelectedCodes.join(', '));
          return { ...prev, selectedCodes: newSelectedCodes };
        }
        return prev;
      } else {
        const newSelectedCodes = [...prev.selectedCodes, ...groupCodes];
        setCodes(newSelectedCodes.join(', '));
        return { ...prev, selectedCodes: newSelectedCodes };
      }
    });
  };

  const handleClearCodes = () => {
    if (confirm("Deseja limpar todas as verbas selecionadas?")) {
      setState(prev => ({ ...prev, selectedCodes: [] }));
      setCodes("");
    }
  };

  const handleCollapse = (category: string) => {
    setState(prev => ({...prev, isCollapsed: {...prev.isCollapsed, [category]: !prev.isCollapsed[category]}}))
  }

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
              <button
                onClick={() => setState(prev => ({ ...prev, viewMode: prev.viewMode === 'card' ? 'list' : 'card' }))}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                  state.viewMode === 'card' ? 'bg-primary' : 'bg-gray-200'
                }`}
              >
                {state.viewMode === 'card' ? <LayoutGrid className="h-5 w-5 text-white"/> : <List className="h-5 w-5 text-gray-700"/>}
              </button>
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
                  <div key={category} className="border rounded-md p-2">
                    <div className="flex justify-between items-center cursor-pointer" onClick={() => handleCollapse(category)}>
                      <h3 className="text-sm font-medium mb-2">{category}</h3>
                      {state.isCollapsed[category] ? <ChevronDown className="h-5 w-5"/> : <ChevronUp className="h-5 w-5"/>}
                    </div>
                    { !state.isCollapsed[category] && (
                    <div className="space-y-4">
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
                                  isCodeSelected(code.code) ? 'border-blue-500 ring-2 ring-blue-500' : ''
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
            <div className="flex justify-between items-center">
              <Label>Códigos Selecionados</Label>
              <Button 
                variant="outline" 
                size="sm"
                onClick={handleClearCodes}
                className="text-sm"
              >
                Limpar Seleção
              </Button>
            </div>
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