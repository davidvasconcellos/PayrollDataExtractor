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

export default function CodeInputSection({
  codes,
  setCodes,
  templates,
  onTemplateSelect
}: CodeInputSectionProps) {
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
    const currentCodes = codes.split(/[\s,]+/).filter(Boolean);
    if (!currentCodes.includes(code)) {
      const newCodes = [...currentCodes, code].join(', ');
      setCodes(newCodes);
    }
  };

  return (
    <section className="mb-8">
      <Card>
        <CardHeader>
          <CardTitle>Códigos das Verbas</CardTitle>
          <CardDescription>
            Selecione verbas pré-definidas, um modelo de cargo ou digite manualmente os códigos.
          </CardDescription>
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
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {predefinedCodes
                        ?.filter(code => code.category === category)
                        .map(code => (
                          <button
                            key={code.code}
                            onClick={() => handleCodeSelect(code.code)}
                            className="text-left px-3 py-2 text-sm rounded-md border hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
                          >
                            <span className="font-mono text-xs text-gray-500">{code.code}</span>
                            <br />
                            {code.description}
                          </button>
                        ))}
                    </div>
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