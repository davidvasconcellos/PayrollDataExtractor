import { ExtractedPayrollItem, ProcessedPayslip } from '@shared/schema';

export type PDFSource = 'ERP' | 'RH';

interface PDFPage {
  text: string;
  pageNumber: number;
}

/**
 * Extrai texto de um PDF buffer usando uma abordagem heurística
 * que analisa o buffer em busca de padrões de texto reconhecíveis
 */
export async function extractTextFromPDF(pdfBuffer: Buffer): Promise<PDFPage[]> {
  console.log("Iniciando extração de padrões de texto do PDF...");
  
  try {
    // Extrair texto do PDF usando uma técnica mais robusta
    const text = pdfBuffer.toString('utf-8')
      .replace(/\\u[0-9a-f]{4}/g, '')
      .replace(/[^\x20-\x7E\n\r\t]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    // Estimar número de páginas com base no tamanho do PDF 
    // (heurística simples: aproximadamente 4000 bytes por página)
    const estimatedPages = Math.max(1, Math.ceil(pdfBuffer.length / 4000));
    
    console.log(`PDF analisado: tamanho ${pdfBuffer.length} bytes`);
    console.log(`Número estimado de páginas: ${estimatedPages}`);
    
    // Dividir o texto em páginas usando heurística
    const pageTexts: PDFPage[] = [];
    
    if (estimatedPages > 1) {
      // Divisão proporcional do texto pelo número estimado de páginas
      const approximatePageLength = Math.ceil(text.length / estimatedPages);
      
      // Procurar por divisores de página típicos
      const pageBreakPatterns = [
        /Página\s+\d+\s+de\s+\d+/gi,  // "Página X de Y"
        /Page\s+\d+\s+of\s+\d+/gi,    // "Page X of Y"
        /^\s*\d+\s*$/gm,              // Número de página isolado
        /\f/g,                        // Form feed character
        /\n\s*\n\s*\n/g               // Múltiplas linhas em branco
      ];
      
      // Tentar dividir por marcadores de página
      let lastSplit = 0;
      let pageCount = 0;
      const splits: number[] = [];
      
      // Procurar por todos os possíveis divisores de página
      for (const pattern of pageBreakPatterns) {
        let match;
        const regex = new RegExp(pattern);
        let tempText = text;
        let offset = 0;
        
        // Encontrar todas as ocorrências do padrão
        while ((match = regex.exec(tempText)) !== null) {
          const position = match.index + offset;
          if (position > lastSplit + 100) { // Pelo menos 100 caracteres entre quebras
            splits.push(position);
            lastSplit = position;
          }
        }
      }
      
      // Se encontrou divisores de página, usar eles
      if (splits.length > 0) {
        splits.sort((a, b) => a - b);
        
        // Criar páginas com base nos divisores encontrados
        let startPos = 0;
        for (let i = 0; i < splits.length; i++) {
          // Só adiciona se tiver conteúdo suficiente
          if (splits[i] - startPos > 50) {
            pageTexts.push({
              text: text.substring(startPos, splits[i]),
              pageNumber: pageTexts.length + 1
            });
          }
          startPos = splits[i];
        }
        
        // Adicionar última página
        if (startPos < text.length) {
          pageTexts.push({
            text: text.substring(startPos),
            pageNumber: pageTexts.length + 1
          });
        }
      }
      
      // Se não encontrou divisores claros ou encontrou poucos, usar divisão simples
      if (pageTexts.length < estimatedPages / 2) {
        pageTexts.length = 0; // Limpar o array
        
        for (let i = 0; i < estimatedPages; i++) {
          const startIndex = i * approximatePageLength;
          const endIndex = (i + 1) * approximatePageLength;
          pageTexts.push({
            text: text.substring(startIndex, Math.min(endIndex, text.length)),
            pageNumber: i + 1
          });
        }
      }
    } else {
      // Se houver apenas uma página, use todo o texto
      pageTexts.push({
        text: text,
        pageNumber: 1
      });
    }
    
    console.log(`Extração concluída. Textos divididos em ${pageTexts.length} páginas.`);
    pageTexts.forEach((page, index) => {
      console.log(`Página ${page.pageNumber} possui ${page.text.length} caracteres`);
    });
    
    return pageTexts;
  } catch (error: any) {
    console.error("Erro ao processar o PDF:", error);
    // Em caso de erro, retornamos uma página com o que conseguimos extrair
    return [{
      text: pdfBuffer.toString('utf-8', 0, 1000).replace(/[^\x20-\x7E\n\r\t]/g, ' '),
      pageNumber: 1
    }];
  }
}

function extractERPDate(text: string): string | null {
  const patterns = [
    /(?:Compet[êe]ncia|Per[íi]odo|Data[^:]*?):\s*(\d{2})[\/\s-](\d{4})/i,
    /(\d{2})[\/\s-](\d{4})/
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      return `${match[1]}/${match[2]}`;
    }
  }
  return null;
}

function extractRHDate(text: string): string | null {
  const monthMap: { [key: string]: string } = {
    'janeiro': '01', 'fevereiro': '02', 'março': '03', 'marco': '03',
    'abril': '04', 'maio': '05', 'junho': '06', 'julho': '07',
    'agosto': '08', 'setembro': '09', 'outubro': '10',
    'novembro': '11', 'dezembro': '12'
  };

  const monthPattern = Object.keys(monthMap).join('|');
  const pattern = new RegExp(`(${monthPattern})[\/\\s]*de[\\s]*?(\\d{4})`, 'i');

  const match = text.match(pattern);
  if (match) {
    const month = monthMap[match[1].toLowerCase()];
    return `${month}/${match[2]}`;
  }
  return null;
}

function extractERPItems(text: string, codes: string[]): ExtractedPayrollItem[] {
  const items: ExtractedPayrollItem[] = [];
  const lines = text.split(/[\n\r]+/);

  for (const code of codes) {
    const patterns = [
      new RegExp(`${code}[\\s.]*([^\\n\\r]+?)\\s*R\\$\\s*(\\d+[.,]\\d{2})`, 'gi'),
      new RegExp(`${code}[\\s.]*([^\\n\\r]+?)\\s*(\\d+[.,]\\d{2})`, 'gi'),
      new RegExp(`${code}\\s*[-:]?\\s*([^\\n\\r]+?)\\s*R?\\$?\\s*(\\d+[.,]\\d{2})`, 'gi')
    ];

    for (const line of lines) {
      for (const pattern of patterns) {
        const match = line.match(pattern);
        if (match) {
          const description = match[1].trim();
          const value = parseFloat(
            match[2].replace(/\./g, '').replace(',', '.')
          );

          const existingItem = items.find(item => item.code === code);
          if (existingItem) {
            existingItem.value += value;
          } else {
            items.push({ code, description, value });
          }
          break;
        }
      }
    }
  }

  return items;
}

function extractRHItems(text: string, codes: string[]): ExtractedPayrollItem[] {
  const items: ExtractedPayrollItem[] = [];
  const lines = text.split(/[\n\r]+/);

  for (const code of codes) {
    const patterns = [
      new RegExp(`${code}[\\s.]+([^\\n\\r]+?)\\s+(\\d+[.,]\\d{2})`, 'i'),
      new RegExp(`${code}[\\s.]+([^\\n\\r]+?)\\s+R\\$\\s*(\\d+[.,]\\d{2})`, 'i')
    ];

    for (const line of lines) {
      for (const pattern of patterns) {
        const match = line.match(pattern);
        if (match) {
          const description = match[1].trim();
          const valueIndex = pattern.toString().includes('R\\$') ? 2 : 1;
          const value = parseFloat(
            match[valueIndex].replace(/\./g, '').replace(',', '.')
          );

          const existingItem = items.find(item => item.code === code);
          if (existingItem) {
            existingItem.value += value;
          } else {
            items.push({ code, description, value });
          }
          break;
        }
      }
    }
  }

  return items;
}

/**
 * Extract date from a PDF page text based on source type
 */
export function extractDate(text: string, source: PDFSource): string {
  const dateExtractor = source === 'ERP' ? extractERPDate : extractRHDate;
  const date = dateExtractor(text);
  return date || '01/2000'; // Fallback para evitar dados nulos
}

/**
 * Extract payroll items from ERP PDF
 */
export function extractERPPayrollItems(text: string, codes: string[]): ExtractedPayrollItem[] {
  return extractERPItems(text, codes);
}

/**
 * Extract payroll items from RH PDF
 * Adaptado para reconhecer formatos diferentes do RH Bahia
 */
export function extractRHPayrollItems(text: string, codes: string[]): ExtractedPayrollItem[] {
  return extractRHItems(text, codes);
}

/**
 * Process PDF content based on source type
 * Agora suporta múltiplas páginas com datas diferentes
 */
export async function processPDF(
  pdfBuffer: Buffer, 
  codes: string[], 
  source: PDFSource
): Promise<ProcessedPayslip[]> {
  try {
    console.log(`Processando PDF de fonte ${source}`, codes);
    
    // Extrair páginas do PDF
    const pages = await extractTextFromPDF(pdfBuffer);
    const results: ProcessedPayslip[] = [];
    
    // Processar cada página extraída
    for (const page of pages) {
      console.log(`Processando página ${page.pageNumber}`);
      
      // Extrair data com base no tipo de fonte
      const date = extractDate(page.text, source);
      console.log('Data extraída:', date);
      
      // Extrair itens com base no tipo de fonte
      const items = source === 'ERP' 
        ? extractERPPayrollItems(page.text, codes)
        : extractRHPayrollItems(page.text, codes);
      
      console.log(`Encontrados ${items.length} itens na página ${page.pageNumber}`);
      
      // Só adicionar resultados se encontrou itens
      if (items.length > 0) {
        results.push({ 
          date, 
          items, 
          source 
        });
      }
    }
    
    console.log(`Processamento finalizado. Encontrados ${results.length} conjuntos de dados.`);
    return results;
  } catch (error) {
    console.error('Erro ao processar PDF:', error);
    return []; // Retornar array vazio em caso de erro
  }
}

/**
 * Format currency value
 */
export function formatCurrency(value: number): string {
  return `R$ ${value.toFixed(2).replace('.', ',')}`;
}