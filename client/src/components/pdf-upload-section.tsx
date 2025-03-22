import { useState, useRef } from "react";
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, X, Wand2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface PDFUploadSectionProps {
  type: "ERP" | "RH";
  codes: string;
  onProcessSuccess: () => void;
}

export default function PDFUploadSection({ 
  type, 
  codes, 
  onProcessSuccess 
}: PDFUploadSectionProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  
  const isERP = type === "ERP";
  const bgColor = isERP ? "bg-blue-600" : "bg-green-600";
  const hoverColor = isERP ? "hover:bg-blue-700" : "hover:bg-green-700";
  const borderColor = isERP ? "focus:border-blue-500 focus:ring-blue-500" : "focus:border-green-500 focus:ring-green-500";
  const textColor = isERP ? "text-blue-600" : "text-green-600";
  const textHoverColor = isERP ? "hover:text-blue-800" : "hover:text-green-800";
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      
      // Validate file type
      if (selectedFile.type !== "application/pdf") {
        toast({
          variant: "destructive",
          title: "Tipo de arquivo inválido",
          description: "Por favor, selecione um arquivo PDF",
        });
        return;
      }
      
      // Validate file size (10MB max)
      if (selectedFile.size > 10 * 1024 * 1024) {
        toast({
          variant: "destructive",
          title: "Arquivo muito grande",
          description: "O tamanho máximo permitido é 10MB",
        });
        return;
      }
      
      setFile(selectedFile);
    }
  };
  
  const handleRemoveFile = () => {
    setFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };
  
  const handleProcessFile = async () => {
    if (!file) {
      toast({
        variant: "destructive",
        title: "Nenhum arquivo selecionado",
        description: "Por favor, selecione um arquivo PDF para processar",
      });
      return;
    }
    
    if (!codes.trim()) {
      toast({
        variant: "destructive",
        title: "Nenhum código informado",
        description: "Por favor, informe os códigos das verbas para extrair",
      });
      return;
    }
    
    try {
      setIsUploading(true);
      
      const formData = new FormData();
      formData.append("pdf", file);
      formData.append("source", type);
      formData.append("codes", codes);
      
      const response = await fetch("/api/process-pdf", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || `Erro ao processar PDF (${response.status})`);
      }
      
      onProcessSuccess();
      
    } catch (error) {
      console.error("Error processing PDF:", error);
      toast({
        variant: "destructive",
        title: "Erro ao processar o PDF",
        description: error instanceof Error ? error.message : "Ocorreu um erro ao processar o arquivo",
      });
    } finally {
      setIsUploading(false);
    }
  };
  
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };
  
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      
      // Validate file type
      if (droppedFile.type !== "application/pdf") {
        toast({
          variant: "destructive",
          title: "Tipo de arquivo inválido",
          description: "Por favor, selecione um arquivo PDF",
        });
        return;
      }
      
      // Validate file size (10MB max)
      if (droppedFile.size > 10 * 1024 * 1024) {
        toast({
          variant: "destructive",
          title: "Arquivo muito grande",
          description: "O tamanho máximo permitido é 10MB",
        });
        return;
      }
      
      setFile(droppedFile);
    }
  };
  
  return (
    <Card>
      <CardHeader className={`${bgColor} text-white`}>
        <CardTitle>{type}</CardTitle>
        <CardDescription className="text-white/90">
          Upload de contracheques do sistema {type}.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-6">
        <div className="flex flex-col space-y-4">
          <div
            className="border-2 border-dashed border-gray-300 rounded-md px-6 pt-5 pb-6 flex justify-center items-center flex-col"
            onDragOver={handleDragOver}
            onDrop={handleDrop}
          >
            <div className="space-y-1 text-center">
              <FileText className="mx-auto h-12 w-12 text-gray-400" />
              <div className="flex text-sm text-gray-600">
                <label
                  htmlFor={`${type.toLowerCase()}FileUpload`}
                  className={`relative cursor-pointer bg-white rounded-md font-medium ${textColor} ${textHoverColor} focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 ${borderColor}`}
                >
                  <span>Selecionar arquivo</span>
                  <input
                    id={`${type.toLowerCase()}FileUpload`}
                    type="file"
                    className="sr-only"
                    accept=".pdf"
                    onChange={handleFileChange}
                    ref={fileInputRef}
                  />
                </label>
                <p className="pl-1">ou arraste e solte</p>
              </div>
              <p className="text-xs text-gray-500">PDF até 10MB</p>
            </div>
          </div>
          
          {file && (
            <div className="p-4 bg-gray-50 rounded-md">
              <div className="flex items-center">
                <FileText className="h-5 w-5 text-gray-400" />
                <span className="ml-2 text-sm text-gray-500 truncate">
                  {file.name}
                </span>
                <button
                  type="button"
                  className="ml-auto text-gray-500 hover:text-gray-700"
                  onClick={handleRemoveFile}
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
          )}
          
          <Button
            className={`${bgColor} ${hoverColor}`}
            onClick={handleProcessFile}
            disabled={isUploading || !file}
          >
            <Wand2 className="mr-2 h-5 w-5" />
            {isUploading ? "Processando..." : "Processar"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
