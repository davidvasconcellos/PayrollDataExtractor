import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { FileText, LogOut, Sliders } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import CodeInputSection from "@/components/code-input-section";
import PDFUploadSection from "@/components/pdf-upload-section";
import ResultsTable from "@/components/results-table";
import TemplateModal from "@/components/template-modal";

interface TemplateType {
  id: number;
  name: string;
  codes: string;
}

export default function Home() {
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [codes, setCodes] = useState("");
  const [processedData, setProcessedData] = useState<any[]>([]);
  const [codeHeaders, setCodeHeaders] = useState<string[]>([]);

  // Fetch templates
  const { data: templatesData } = useQuery({
    queryKey: ['/api/templates'],
    staleTime: 0, // Always refetch templates when requested
  });
  
  // Safe templates array
  const templates: TemplateType[] = Array.isArray(templatesData) ? templatesData : [];

  // Fetch payroll data
  const { data: payrollData, refetch: refetchPayrollData } = useQuery({
    queryKey: ['/api/payroll-data'],
    staleTime: 0
  });
  
  // Update state when payroll data changes
  useEffect(() => {
    if (payrollData && typeof payrollData === 'object') {
      const data = (payrollData as any)?.data || [];
      const codes = (payrollData as any)?.codes || [];
      
      if (Array.isArray(data) && Array.isArray(codes)) {
        setProcessedData(data);
        setCodeHeaders(codes);
      }
    }
  }, [payrollData]);

  // Handle logout
  const handleLogout = async () => {
    try {
      await logout();
      toast({
        title: "Logout realizado com sucesso",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erro ao fazer logout",
        description: "Não foi possível fazer logout",
      });
    }
  };

  // Handle template selection
  const handleTemplateSelect = (template: TemplateType) => {
    setCodes(template.codes);
  };

  // Handle export CSV
  const handleExportCSV = () => {
    if (processedData.length === 0) {
      toast({
        variant: "destructive",
        title: "Nenhum dado para exportar",
        description: "Processe alguns PDFs primeiro",
      });
      return;
    }
    
    window.open('/api/export/csv', '_blank');
  };

  // Handle export JSON
  const handleExportJSON = () => {
    if (processedData.length === 0) {
      toast({
        variant: "destructive",
        title: "Nenhum dado para exportar",
        description: "Processe alguns PDFs primeiro",
      });
      return;
    }
    
    window.open('/api/export/json', '_blank');
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center">
              <FileText className="h-8 w-8 text-blue-600" />
              <h1 className="ml-2 text-xl font-semibold text-gray-900">
                Sistema de Extração de Contracheques
              </h1>
            </div>
            
            <div className="flex items-center space-x-4">
              <span className="text-sm font-medium text-gray-700">
                Olá, {user?.username}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setTemplateModalOpen(true)}
              >
                <Sliders className="mr-2 h-4 w-4" />
                Gerenciar Modelos
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleLogout}
              >
                <LogOut className="mr-2 h-4 w-4" />
                Sair
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Codes Input Section */}
        <CodeInputSection 
          codes={codes} 
          setCodes={setCodes} 
          templates={templates} 
          onTemplateSelect={handleTemplateSelect} 
        />

        {/* Upload Sections */}
        <section className="mb-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <PDFUploadSection
              type="ERP"
              codes={codes}
              onProcessSuccess={() => {
                refetchPayrollData();
                toast({
                  title: "PDF processado com sucesso",
                  description: "Os dados foram extraídos e adicionados à tabela",
                });
              }}
            />
            
            <PDFUploadSection
              type="RH"
              codes={codes}
              onProcessSuccess={() => {
                refetchPayrollData();
                toast({
                  title: "PDF processado com sucesso",
                  description: "Os dados foram extraídos e adicionados à tabela",
                });
              }}
            />
          </div>
        </section>

        {/* Results Table */}
        <ResultsTable 
          data={processedData} 
          codeHeaders={codeHeaders}
          onExportCSV={handleExportCSV}
          onExportJSON={handleExportJSON}
        />
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 py-4">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-center text-sm text-gray-500">
            Sistema de Extração de Contracheques © {new Date().getFullYear()}
          </p>
        </div>
      </footer>

      {/* Template Modal */}
      <TemplateModal 
        isOpen={templateModalOpen} 
        onClose={() => setTemplateModalOpen(false)}
        onTemplateRefresh={() => {
          queryClient.invalidateQueries({ queryKey: ['/api/templates'] });
        }}
      />
    </div>
  );
}
