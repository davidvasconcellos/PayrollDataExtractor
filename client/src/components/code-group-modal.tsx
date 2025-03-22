import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "./ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { apiRequest } from "../lib/queryClient";
import { queryClient } from "../lib/queryClient";
import { useToast } from "../hooks/use-toast";

interface CodeGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCodeGroupRefresh: () => void;
}

interface CodeGroup {
  id: number;
  displayName: string;
  codes: string;
}

export default function CodeGroupModal({
  isOpen,
  onClose,
  onCodeGroupRefresh,
}: CodeGroupModalProps) {
  const [codeGroups, setCodeGroups] = useState<CodeGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [codes, setCodes] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const { toast } = useToast();

  const fetchCodeGroups = async () => {
    setLoading(true);
    try {
      const data = await apiRequest("/api/code-groups", {
        method: "GET",
      });
      setCodeGroups(data || []);
    } catch (error) {
      console.error("Failed to fetch code groups:", error);
      toast({
        title: "Erro",
        description: "Falha ao carregar grupos de códigos",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchCodeGroups();
    }
    return () => {
      resetForm();
    };
  }, [isOpen]);

  const resetForm = () => {
    setDisplayName("");
    setCodes("");
    setEditingId(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!displayName || !codes) {
      toast({
        title: "Campos obrigatórios",
        description: "Nome e códigos são obrigatórios",
        variant: "destructive",
      });
      return;
    }
    
    setLoading(true);
    try {
      if (editingId === null) {
        // Create new code group
        await apiRequest("/api/code-groups", {
          method: "POST",
          body: { displayName, codes },
        });
        toast({
          title: "Sucesso",
          description: "Grupo de códigos criado com sucesso",
        });
      } else {
        // Update existing code group
        await apiRequest(`/api/code-groups/${editingId}`, {
          method: "PUT",
          body: { displayName, codes },
        });
        toast({
          title: "Sucesso",
          description: "Grupo de códigos atualizado com sucesso",
        });
      }
      resetForm();
      fetchCodeGroups();
      onCodeGroupRefresh();
    } catch (error) {
      console.error("Failed to save code group:", error);
      toast({
        title: "Erro",
        description: "Falha ao salvar grupo de códigos",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEditCodeGroup = (codeGroup: CodeGroup) => {
    setDisplayName(codeGroup.displayName);
    setCodes(codeGroup.codes);
    setEditingId(codeGroup.id);
  };

  const handleDeleteCodeGroup = async (id: number) => {
    setLoading(true);
    try {
      await apiRequest(`/api/code-groups/${id}`, {
        method: "DELETE",
      });
      toast({
        title: "Sucesso",
        description: "Grupo de códigos excluído com sucesso",
      });
      fetchCodeGroups();
      onCodeGroupRefresh();
    } catch (error) {
      console.error("Failed to delete code group:", error);
      toast({
        title: "Erro",
        description: "Falha ao excluir grupo de códigos",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[90%] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Gerenciar Grupos de Códigos</DialogTitle>
          <DialogDescription>
            Use grupos de códigos para agrupar códigos diferentes que representam a mesma verba.
            <br />
            Por exemplo, "00002" e "0002" para "VENCIMENTO".
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <form onSubmit={handleSubmit} className="space-y-4 mb-6 border-b pb-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="displayName" className="text-sm font-medium mb-1 block">
                  Nome do Grupo:
                </label>
                <Input
                  id="displayName"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Ex: VENCIMENTO"
                />
              </div>
              <div>
                <label htmlFor="codes" className="text-sm font-medium mb-1 block">
                  Códigos (separados por espaço ou vírgula):
                </label>
                <Textarea
                  id="codes"
                  value={codes}
                  onChange={(e) => setCodes(e.target.value)}
                  placeholder="Ex: 00002, 0002"
                  rows={2}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={resetForm}>
                Limpar
              </Button>
              <Button type="submit" disabled={loading}>
                {editingId === null ? "Adicionar" : "Atualizar"}
              </Button>
            </div>
          </form>

          <div>
            <h3 className="text-lg font-medium mb-2">Grupos Existentes</h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome do Grupo</TableHead>
                  <TableHead>Códigos</TableHead>
                  <TableHead className="w-[150px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {codeGroups.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center py-6">
                      Nenhum grupo de códigos encontrado.
                    </TableCell>
                  </TableRow>
                ) : (
                  codeGroups.map((codeGroup) => (
                    <TableRow key={codeGroup.id}>
                      <TableCell>{codeGroup.displayName}</TableCell>
                      <TableCell>{codeGroup.codes}</TableCell>
                      <TableCell className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleEditCodeGroup(codeGroup)}
                        >
                          Editar
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleDeleteCodeGroup(codeGroup.id)}
                        >
                          Excluir
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}