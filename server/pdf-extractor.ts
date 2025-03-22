import { ExtractedPayrollItem, ProcessedPayslip } from '@shared/schema';

export type PDFSource = 'ERP' | 'RH';

interface PDFPage {
  text: string;
  pageNumber: number;
}

/**
 * Extrai texto "simulado" de um PDF buffer
 * 
 * Devido a problemas com bibliotecas de extração de PDF, estamos usando uma abordagem heurística
 * que analisa o buffer em busca de padrões de texto reconhecíveis
 */
export async function extractTextFromPDF(pdfBuffer: Buffer): Promise<PDFPage[]> {
  console.log("Iniciando extração de padrões de texto do PDF...");
  
  try {
    // Extrair texto do PDF usando uma técnica de busca de padrões no buffer
    // Convert buffer to string (limited to readable ASCII characters)
    const text = pdfBuffer.toString('utf-8', 0, Math.min(pdfBuffer.length, 20000))
      .replace(/\\u[0-9a-f]{4}/g, '')
      .replace(/[^\x20-\x7E\n\r\t]/g, ' ');
    
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

/**
 * Extract date from a PDF page text based on source type
 */
export function extractDate(text: string, source: PDFSource): string {
  console.log(`Extraindo data da página, fonte: ${source}`);
  
  if (source === 'ERP') {
    // Tenta encontrar formato MM/YYYY para ERP após "Data de Referência:"
    const dateMatchERP = text.match(/Data\s+de\s+Refer[êe]ncia:[\s\n]*(\d{2}\/\d{4})/i);
    
    if (dateMatchERP) {
      console.log('Data ERP encontrada:', dateMatchERP[1]);
      return dateMatchERP[1];
    }
    
    // Alternativa para quando a data está na linha seguinte
    const altDateMatchERP = text.match(/Data\s+de\s+Refer[êe]ncia:\s*\n\s*(\d{2}\/\d{4})/i);
    if (altDateMatchERP) {
      console.log('Data ERP alternativa encontrada:', altDateMatchERP[1]);
      return altDateMatchERP[1];
    }

    // Alternativa para qualquer padrão MM/AAAA no documento
    const genericDateMatch = text.match(/(\d{2})\/(\d{4})/);
    if (genericDateMatch) {
      console.log('Data genérica encontrada (formato MM/AAAA):', genericDateMatch[0]);
      return genericDateMatch[0];
    }
  } 
  else if (source === 'RH') {
    // Para RH Bahia - procura por padrão Mês/Ano (ex: Abril/2022)
    const monthNames = '(Janeiro|Fevereiro|Março|Marco|Abril|Maio|Junho|Julho|Agosto|Setembro|Outubro|Novembro|Dezembro)';
    const dateMatchRH = text.match(new RegExp(monthNames + '\\/\\d{4}', 'i'));
    
    if (dateMatchRH) {
      console.log('Data RH encontrada (mês por extenso):', dateMatchRH[0]);
      return dateMatchRH[0];
    }
    
    // Alternativa para formato Data de Referência: com mês por extenso
    const altDateMatchRH = text.match(new RegExp(`Data\\s+de\\s+Refer[êe]ncia:.*?${monthNames}\\s*\\/\\s*\\d{4}`, 'i'));
    if (altDateMatchRH) {
      const match = altDateMatchRH[0].match(new RegExp(`${monthNames}\\s*\\/\\s*\\d{4}`, 'i'));
      if (match) {
        console.log('Data RH alternativa encontrada:', match[0]);
        return match[0];
      }
    }
    
    // Formato numérico para RH
    const numericDateMatchRH = text.match(/Data\s+de\s+Refer[êe]ncia:.*?(\d{2})\/(\d{4})/i);
    if (numericDateMatchRH) {
      console.log('Data RH numérica encontrada:', `${numericDateMatchRH[1]}/${numericDateMatchRH[2]}`);
      return `${numericDateMatchRH[1]}/${numericDateMatchRH[2]}`;
    }
  }
  
  // Busca genérica final para qualquer formato de data
  const lastDateMatch = text.match(/(\d{2})\/(\d{4})/);
  if (lastDateMatch) {
    console.log('Data encontrada (último recurso):', lastDateMatch[0]);
    return lastDateMatch[0];
  }
  
  console.log('Nenhuma data encontrada na página, usando data atual');
  
  // Se nenhum formato for encontrado, usa a data atual
  const today = new Date();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const year = today.getFullYear();
  return `${month}/${year}`;
}

/**
 * Extract payroll items from ERP PDF
 */
export function extractERPPayrollItems(text: string, codes: string[]): ExtractedPayrollItem[] {
  const items: ExtractedPayrollItem[] = [];
  const lines = text.split('\n');
  
  console.log("ERP - Códigos a serem extraídos:", codes);
  
  // Process each line to find matches for the provided codes
  for (const line of lines) {
    // Padrão mais comum em contracheques: 4 dígitos seguidos de descrição e valor
    // Adaptado para múltiplas possibilidades de formatação
    const patternMain = /\b(\d{4})\b[.\s]+([A-Za-zÀ-úÇç0-9\.\s-]+)\s+R\$\s+([\d\.,]+)/i;
    const patternAlt = /\b(\d{4})\b\s+([A-Za-zÀ-úÇç0-9\.\s-]+)\s+[\d\.,]+/i;
    
    let lineMatch = line.match(patternMain);
    if (!lineMatch) {
      lineMatch = line.match(patternAlt);
    }
    
    if (lineMatch) {
      const code = lineMatch[1];
      const description = lineMatch[2].trim();
      // Extrai valor com formatação R$
      let valueStr = '0';
      const valueMatch = line.match(/R\$\s+([\d\.,]+)/);
      if (valueMatch) {
        valueStr = valueMatch[1].replace(/\./g, '').replace(',', '.');
      }
      const value = parseFloat(valueStr || '0');
      
      if (!isNaN(value)) {
        console.log(`ERP - Encontrado no PDF: Código ${code}, Descrição: ${description}, Valor: ${value}`);
        
        // Verifica se este código está na lista de códigos solicitados
        if (codes.includes(code)) {
          console.log(`ERP - Código ${code} está na lista de códigos a extrair`);
          
          // Check if we already have this code in the results
          const existingIndex = items.findIndex(item => item.code === code);
          
          if (existingIndex >= 0) {
            // Sum the values for duplicate codes
            items[existingIndex].value += value;
          } else {
            items.push({
              code,
              description,
              value
            });
          }
        }
      }
    }
  }
  
  console.log("ERP - Itens extraídos:", items);
  return items;
}

/**
 * Extract payroll items from RH PDF
 * Adaptado para reconhecer formatos diferentes do RH Bahia
 */
export function extractRHPayrollItems(text: string, codes: string[]): ExtractedPayrollItem[] {
  const items: ExtractedPayrollItem[] = [];
  const lines = text.split('\n');
  
  console.log("RH - Códigos a serem extraídos:", codes);
  
  // Process each line to find matches for the provided codes
  for (const line of lines) {
    // Padrões variados para RH
    const patterns = [
      /\b(\d{4})\b[.\s]+([A-Za-zÀ-úÇç0-9\.\s-]+)\s+R\$\s+([\d\.,]+)/i,  // Padrão comum com R$
      /\b(\d{4})\b\s+([A-Za-zÀ-úÇç0-9\.\s-]+)\s+([\d\.,]+)/i,  // Sem R$ explicito
      /\b(\d{3,4})\b\s+([A-Za-zÀ-úÇç0-9\.\s-]+)\s+[\d\.,]+/i  // Código com 3 ou 4 dígitos
    ];
    
    let lineMatch = null;
    for (const pattern of patterns) {
      lineMatch = line.match(pattern);
      if (lineMatch) break;
    }
    
    if (lineMatch) {
      const code = lineMatch[1].padStart(4, '0');  // Padroniza para 4 dígitos
      const description = lineMatch[2].trim();
      
      // Extrai valor com ou sem formatação R$
      let valueStr = '0';
      const valueMatchWithR = line.match(/R\$\s+([\d\.,]+)/);
      if (valueMatchWithR) {
        valueStr = valueMatchWithR[1];
      } else {
        // Tenta encontrar um valor numérico no final da linha
        const valueMatch = line.match(/(\d+[\d\.,]+)$/);
        if (valueMatch) {
          valueStr = valueMatch[1];
        }
      }
      
      // Limpa e converte o valor
      valueStr = valueStr.replace(/\./g, '').replace(',', '.');
      const value = parseFloat(valueStr || '0');
      
      if (!isNaN(value)) {
        console.log(`RH - Encontrado no PDF: Código ${code}, Descrição: ${description}, Valor: ${value}`);
        
        // Verifica se este código está na lista de códigos solicitados
        if (codes.includes(code)) {
          console.log(`RH - Código ${code} está na lista de códigos a extrair`);
          
          // Check if we already have this code in the results
          const existingIndex = items.findIndex(item => item.code === code);
          
          if (existingIndex >= 0) {
            // Sum the values for duplicate codes
            items[existingIndex].value += value;
          } else {
            items.push({
              code,
              description,
              value
            });
          }
        }
      }
    }
  }
  
  console.log("RH - Itens extraídos:", items);
  return items;
}

/**
 * Process PDF content based on source type
 * Agora suporta múltiplas páginas com datas diferentes
 */
export async function processPDF(pdfBuffer: Buffer, codes: string[], source: PDFSource): Promise<ProcessedPayslip[]> {
  // Extrair texto de todas as páginas
  const pages = await extractTextFromPDF(pdfBuffer);
  const results: ProcessedPayslip[] = [];
  
  // Processar cada página separadamente
  for (const page of pages) {
    console.log(`Processando página ${page.pageNumber}...`);
    
    const date = extractDate(page.text, source);
    let items: ExtractedPayrollItem[] = [];
    
    if (source === 'ERP') {
      items = extractERPPayrollItems(page.text, codes);
    } else if (source === 'RH') {
      items = extractRHPayrollItems(page.text, codes);
    }
    
    // Só adiciona resultados se encontrou itens
    if (items.length > 0) {
      results.push({
        date,
        items,
        source
      });
    }
  }
  
  // Se não encontrou resultados em nenhuma página, retorna um resultado vazio
  if (results.length === 0) {
    console.log("Nenhum resultado encontrado em nenhuma página do PDF");
    const date = new Date();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    
    results.push({
      date: `${month}/${year}`,
      items: [],
      source
    });
  }
  
  return results;
}

/**
 * Format currency value
 */
export function formatCurrency(value: number): string {
  return `R$ ${value.toFixed(2).replace('.', ',')}`;
}