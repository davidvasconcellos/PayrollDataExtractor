import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Pencil, Trash2, File } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface TemplateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTemplateRefresh: () => void;
}

interface Template {
  id: number;
  name: string;
  codes: string;
}

export default function TemplateModal({ 
  isOpen, 
  onClose, 
  onTemplateRefresh 
}: TemplateModalProps) {
  const [templateName, setTemplateName] = useState("");
  const [templateCodes, setTemplateCodes] = useState("");
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const { toast } = useToast();

  // Fetch templates
  const { data: templates, isLoading } = useQuery({
    queryKey: ['/api/templates'],
    enabled: isOpen, // Only fetch when modal is open
  });

  // Create template mutation
  const createTemplateMutation = useMutation({
    mutationFn: async (data: { name: string; codes: string }) => {
      return apiRequest('POST', '/api/templates', data);
    },
    onSuccess: () => {
      toast({
        title: "Modelo salvo com sucesso",
      });
      resetForm();
      onTemplateRefresh();
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Erro ao salvar modelo",
        description: error instanceof Error ? error.message : "Ocorreu um erro ao salvar o modelo",
      });
    }
  });

  // Update template mutation
  const updateTemplateMutation = useMutation({
    mutationFn: async (data: { id: number; name: string; codes: string }) => {
      return apiRequest('PUT', `/api/templates/${data.id}`, { name: data.name, codes: data.codes });
    },
    onSuccess: () => {
      toast({
        title: "Modelo atualizado com sucesso",
      });
      resetForm();
      onTemplateRefresh();
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Erro ao atualizar modelo",
        description: error instanceof Error ? error.message : "Ocorreu um erro ao atualizar o modelo",
      });
    }
  });

  // Delete template mutation
  const deleteTemplateMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest('DELETE', `/api/templates/${id}`);
    },
    onSuccess: () => {
      toast({
        title: "Modelo excluído com sucesso",
      });
      onTemplateRefresh();
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Erro ao excluir modelo",
        description: error instanceof Error ? error.message : "Ocorreu um erro ao excluir o modelo",
      });
    }
  });

  // Reset form state
  const resetForm = () => {
    setTemplateName("");
    setTemplateCodes("");
    setEditingTemplate(null);
  };

  // Handle form submission
  const handleSaveTemplate = async () => {
    if (!templateName || !templateCodes) {
      toast({
        variant: "destructive",
        title: "Campos obrigatórios",
        description: "Preencha o nome e os códigos do modelo",
      });
      return;
    }

    if (editingTemplate) {
      // Update existing template
      updateTemplateMutation.mutate({
        id: editingTemplate.id,
        name: templateName,
        codes: templateCodes
      });
    } else {
      // Create new template
      createTemplateMutation.mutate({
        name: templateName,
        codes: templateCodes
      });
    }
  };

  // Handle edit template
  const handleEditTemplate = (template: Template) => {
    setEditingTemplate(template);
    setTemplateName(template.name);
    setTemplateCodes(template.codes);
  };

  // Handle delete template
  const handleDeleteTemplate = (id: number) => {
    if (confirm("Tem certeza que deseja excluir este modelo?")) {
      deleteTemplateMutation.mutate(id);
    }
  };

  // Reset form when modal is closed
  useEffect(() => {
    if (!isOpen) {
      resetForm();
    }
  }, [isOpen]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <File className="mr-2 h-5 w-5" />
            Gerenciar Modelos
          </DialogTitle>
        </DialogHeader>
        
        {/* Template List */}
        {templates && templates.length > 0 && (
          <div className="mt-2">
            <ul className="border border-gray-200 rounded-md divide-y divide-gray-200">
              {templates.map((template: Template) => (
                <li key={template.id} className="pl-3 pr-4 py-3 flex items-center justify-between text-sm">
                  <div className="w-0 flex-1 flex items-center">
                    <File className="flex-shrink-0 h-5 w-5 text-gray-400" />
                    <span className="ml-2 flex-1 w-0 truncate">{template.name}</span>
                  </div>
                  <div className="ml-4 flex-shrink-0 flex">
                    <button
                      onClick={() => handleEditTemplate(template)}
                      className="font-medium text-blue-600 hover:text-blue-500 flex items-center"
                    >
                      <Pencil className="h-4 w-4 mr-1" />
                      Editar
                    </button>
                    <span className="px-2 text-gray-300">|</span>
                    <button
                      onClick={() => handleDeleteTemplate(template.id)}
                      className="font-medium text-red-600 hover:text-red-500 flex items-center"
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Excluir
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Template Form */}
        <div className="mt-4 space-y-4">
          <div>
            <Label htmlFor="templateName">Nome do Modelo</Label>
            <Input
              id="templateName"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder="Novo Modelo"
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="templateCodes">Códigos</Label>
            <Textarea
              id="templateCodes"
              rows={3}
              value={templateCodes}
              onChange={(e) => setTemplateCodes(e.target.value)}
              placeholder="0002, 0160, 0146"
              className="mt-1 font-mono"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button 
            onClick={handleSaveTemplate}
            disabled={createTemplateMutation.isPending || updateTemplateMutation.isPending}
          >
            {editingTemplate ? 'Atualizar Modelo' : 'Salvar Modelo'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
