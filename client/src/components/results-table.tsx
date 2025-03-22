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
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="font-medium">DATA</TableHead>
                {codeHeaders.map((code) => {
                  // Buscar descrição do código, se disponível
                  const codeData = codeInfo.find(item => item.code === code);
                  const displayText = codeData ? codeData.description : code;
                  
                  return (
                    <TableHead key={code} className="font-medium">
                      {displayText}
                    </TableHead>
                  );
                })}
              </TableRow>
            </TableHeader>
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
                    <TableCell className="font-medium">{row.date}</TableCell>
                    {codeHeaders.map((code) => (
                      <TableCell key={code}>
                        {formatCurrencyValue(row[code])}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
