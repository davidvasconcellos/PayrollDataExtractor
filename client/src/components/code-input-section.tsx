import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface TemplateType {
  id: number;
  name: string;
  codes: string;
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
  const handleTemplateChange = (templateId: string) => {
    const selectedTemplate = templates.find(t => t.id.toString() === templateId);
    if (selectedTemplate) {
      onTemplateSelect(selectedTemplate);
    }
  };
  
  return (
    <section className="mb-8">
      <Card>
        <CardHeader>
          <CardTitle>Códigos das Verbas</CardTitle>
          <CardDescription>
            Digite os códigos das verbas que deseja extrair.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col space-y-4">
            {templates && templates.length > 0 && (
              <div>
                <Label htmlFor="templates" className="block text-sm font-medium text-gray-700">
                  Selecione um modelo
                </Label>
                <Select onValueChange={handleTemplateChange}>
                  <SelectTrigger className="w-full mt-1">
                    <SelectValue placeholder="Selecione um modelo" />
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
            )}
            
            <div>
              <Label htmlFor="verbaCodes" className="block text-sm font-medium text-gray-700">
                Códigos das Verbas
              </Label>
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
        </CardContent>
      </Card>
    </section>
  );
}
