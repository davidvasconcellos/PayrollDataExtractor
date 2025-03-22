import { Card, CardHeader, CardContent, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, FileJson } from "lucide-react";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";

interface CodeInfo {
  code: string;
  description: string;
}

interface ResultsTableProps {
  data: any[];
  codeHeaders: string[];
  codeInfo?: CodeInfo[]; // Nova propriedade para informações de código
  onExportCSV: () => void;
  onExportJSON: () => void;
  onReset?: () => void; // Nova propriedade para função de reset
}

export default function ResultsTable({ 
  data, 
  codeHeaders,
  codeInfo = [], // Default para array vazio
  onExportCSV, 
  onExportJSON,
  onReset
}: ResultsTableProps) {
  const formatCurrencyValue = (value: any) => {
    if (typeof value === 'number') {
      return `R$ ${value.toFixed(2).replace('.', ',')}`;
    }
    return value;
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between py-5">
        <div>
          <CardTitle>Resultados da Extração</CardTitle>
          <CardDescription>Dados extraídos dos contracheques.</CardDescription>
        </div>
        <div className="flex space-x-2">
          {onReset && (
            <Button variant="destructive" size="sm" onClick={onReset}>
              Limpar Dados
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={onExportCSV}>
            <Download className="mr-2 h-4 w-4" />
            Exportar CSV
          </Button>
          <Button variant="outline" size="sm" onClick={onExportJSON}>
            <FileJson className="mr-2 h-4 w-4" />
            Exportar JSON
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Container com rolagem horizontal e vertical */}
        <div 
          className="border rounded-md" 
          style={{
            maxHeight: '500px',
            overflowY: 'auto', // Rolagem vertical
            overflowX: 'auto', // Rolagem horizontal
          }}
        >
          {/* 
            Tabela posicionada para manter o cabeçalho fixo durante a rolagem
            Técnica: Duas tabelas - uma para o cabeçalho e outra para o corpo
          */}
          <div className="relative">
            {/* Tabela de cabeçalho - fixa durante a rolagem */}
            <div className="sticky top-0 z-10 bg-background border-b">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead 
                      className="font-medium bg-muted sticky left-0 z-20"
                      style={{ minWidth: '120px' }}
                    >
                      DATA
                    </TableHead>
                    {codeHeaders.map((code) => {
                      // Buscar descrição do código, se disponível
                      const codeData = codeInfo.find(item => item.code === code);
                      const displayText = codeData ? codeData.description : code;
                      
                      return (
                        <TableHead 
                          key={code} 
                          className="font-medium whitespace-nowrap px-4 py-3"
                          style={{ minWidth: '150px' }}
                        >
                          {displayText}
                        </TableHead>
                      );
                    })}
                  </TableRow>
                </TableHeader>
              </Table>
            </div>

            {/* Tabela principal - corpo com dados */}
            <Table>
              <TableBody>
                {data.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={codeHeaders.length + 1} className="text-center py-8 text-gray-500">
                      Nenhum dado disponível. Faça o upload e processamento de PDFs para ver os resultados.
                    </TableCell>
                  </TableRow>
                ) : (
                  data.map((row, index) => (
                    <TableRow key={index}>
                      <TableCell 
                        className="font-medium sticky left-0 bg-background"
                        style={{ minWidth: '120px' }}
                      >
                        {row.date}
                      </TableCell>
                      {codeHeaders.map((code) => (
                        <TableCell 
                          key={code}
                          className="text-right"
                          style={{ minWidth: '150px' }}
                        >
                          {formatCurrencyValue(row[code])}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
        
        {/* Instruções de uso */}
        {data.length > 0 && codeHeaders.length > 5 && (
          <div className="text-xs text-muted-foreground mt-2">
            Role horizontalmente para ver mais colunas, e verticalmente para ver mais linhas.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
