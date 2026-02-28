// Elementos da UI
const fileInput = document.getElementById('file-input');
const dropZone = document.getElementById('drop-zone');
const fileNameDisplay = document.getElementById('file-name');
const outputFormatSelect = document.getElementById('output-format');
const convertBtn = document.getElementById('convert-btn');
const statusMessage = document.getElementById('status-message');
const previewContainer = document.getElementById('preview-container');
const previewTable = document.getElementById('preview-table');
const sheetSelector = document.getElementById('sheet-selector');
const sheetSelectorContainer = document.getElementById('sheet-selector-container');
const themeToggle = document.getElementById('theme-toggle');
const themeIcon = document.getElementById('theme-icon');
const dropZoneCard = document.querySelector('.upload-card');

// Estado da Aplicação
let currentFile = null;
let currentData = null; // Dados da aba ativa
let workbook = null;    // Workbook do Excel se for XLSX
const supportedFormats = ['csv', 'json', 'xml', 'xlsx'];
const x2js = new X2JS();

// Inicialização de Ícones
lucide.createIcons();

/* --- Gerenciamento de Tema --- */
function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);
}

function updateThemeIcon(theme) {
    themeIcon.setAttribute('data-lucide', theme === 'light' ? 'moon' : 'sun');
    lucide.createIcons();
}

themeToggle.addEventListener('click', () => {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateThemeIcon(newTheme);
});

initTheme();

/* --- Drag and Drop --- */
['dragenter', 'dragover', 'dragleave', 'drop'].forEach(name => {
    dropZone.addEventListener(name, e => { e.preventDefault(); e.stopPropagation(); });
});

dropZone.addEventListener('dragenter', () => dropZone.classList.add('dragover'));
dropZone.addEventListener('dragover', () => dropZone.classList.add('dragover'));
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
dropZone.addEventListener('drop', (e) => {
    dropZone.classList.remove('dragover');
    if (e.dataTransfer.files.length > 0) handleFile(e.dataTransfer.files[0]);
});

fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) handleFile(e.target.files[0]);
});

/* --- Normalização de Dados (Evita o erro [object Object]) --- */
function smartNormalize(obj) {
    if (!obj || typeof obj !== 'object') return [];
    
    // Se já for um array, retornamos ele
    if (Array.isArray(obj)) return obj;
    
    // Se for um objeto, verificamos se ele tem apenas uma chave que contém um array ou outro objeto
    const keys = Object.keys(obj);
    if (keys.length === 1) {
        const value = obj[keys[0]];
        if (Array.isArray(value)) return value;
        if (typeof value === 'object') return smartNormalize(value);
    }
    
    // Se chegamos aqui e não é um array, verificamos se alguma das chaves contém um array
    for (let key of keys) {
        if (Array.isArray(obj[key])) return obj[key];
    }

    // Caso contrário, retornamos o objeto dentro de um array
    return [obj];
}

/* --- Processamento de Arquivo --- */
async function handleFile(file) {
    const ext = file.name.split('.').pop().toLowerCase();
    
    if (!supportedFormats.includes(ext)) {
        showStatus('Formato não suportado.', 'error');
        resetUI();
        return;
    }

    currentFile = file;
    fileNameDisplay.textContent = file.name;
    dropZoneCard.className = `upload-card file-${ext}`;
    showStatus('Lendo arquivo...', '');
    
    try {
        if (ext === 'xlsx') {
            await handleExcel(file);
        } else {
            sheetSelectorContainer.style.display = 'none';
            const rawData = await parseFile(file, ext);
            currentData = smartNormalize(rawData); // Normalização inteligente aqui!
            finishLoading(ext);
        }
    } catch (error) {
        showStatus(`Erro: ${error.message}`, 'error');
        resetUI();
    }
}

async function handleExcel(file) {
    const buffer = await file.arrayBuffer();
    workbook = XLSX.read(buffer, { type: 'array' });
    
    sheetSelector.innerHTML = '';
    workbook.SheetNames.forEach(name => {
        const opt = document.createElement('option');
        opt.value = name;
        opt.textContent = name;
        sheetSelector.appendChild(opt);
    });
    
    sheetSelectorContainer.style.display = 'block';
    loadExcelSheet(workbook.SheetNames[0]);
}

function loadExcelSheet(sheetName) {
    const worksheet = workbook.Sheets[sheetName];
    const rawData = XLSX.utils.sheet_to_json(worksheet);
    currentData = smartNormalize(rawData); // Também normaliza Excel por segurança
    finishLoading('xlsx');
}

sheetSelector.addEventListener('change', (e) => {
    loadExcelSheet(e.target.value);
    showStatus(`Aba "${e.target.value}" carregada.`, 'success');
});

function finishLoading(inputExt) {
    if (!currentData || currentData.length === 0) {
        showStatus("O arquivo/aba parece estar vazio ou não contém uma lista de dados.", "error");
        resetUI();
        return;
    }
    
    generatePreview(currentData);
    setupOutputOptions(inputExt);
    outputFormatSelect.disabled = false;
    convertBtn.disabled = false;
    showStatus('Pronto para converter!', 'success');
}

/* --- Parsing --- */
async function parseFile(file, ext) {
    const text = await file.text();
    if (ext === 'json') {
        try {
            return JSON.parse(text);
        } catch (e) {
            throw new Error("JSON inválido.");
        }
    }
    if (ext === 'csv') {
        return new Promise((resolve, reject) => {
            Papa.parse(text, {
                header: true, skipEmptyLines: true,
                complete: r => resolve(r.data),
                error: e => reject(new Error("CSV inválido."))
            });
        });
    }
    if (ext === 'xml') {
        const json = x2js.xml_str2json(text);
        if (!json) throw new Error("XML Inválido ou mal formatado.");
        return json;
    }
}

/* --- Preview e Edição --- */
function generatePreview(data) {
    previewTable.innerHTML = '';
    const rows = Array.isArray(data) ? data : [data];
    const previewRows = rows.slice(0, 10);
    const headers = Object.keys(previewRows[0] || {});

    if (headers.length === 0) return;

    // Header
    const thead = document.createElement('thead');
    const hRow = document.createElement('tr');
    headers.forEach(h => {
        const th = document.createElement('th');
        th.textContent = h;
        hRow.appendChild(th);
    });
    thead.appendChild(hRow);
    previewTable.appendChild(thead);

    // Body
    const tbody = document.createElement('tbody');
    previewRows.forEach((row, rowIndex) => {
        const tr = document.createElement('tr');
        headers.forEach(h => {
            const td = document.createElement('td');
            const cellValue = row[h];
            
            // Tratamento para não exibir [object Object]
            if (cellValue !== null && typeof cellValue === 'object') {
                td.textContent = JSON.stringify(cellValue);
                td.title = "Dado complexo (objeto/array)";
            } else {
                td.textContent = cellValue || '';
            }
            
            td.contentEditable = true;
            td.addEventListener('blur', () => {
                currentData[rowIndex][h] = td.textContent;
            });

            tr.appendChild(td);
        });
        tbody.appendChild(tr);
    });
    previewTable.appendChild(tbody);
    previewContainer.style.display = 'block';
    lucide.createIcons();
}

/* --- Conversão e Download --- */
function setupOutputOptions(inputExt) {
    outputFormatSelect.innerHTML = '';
    supportedFormats.forEach(f => {
        if (f !== inputExt) {
            const opt = document.createElement('option');
            opt.value = f;
            opt.textContent = f.toUpperCase();
            outputFormatSelect.appendChild(opt);
        }
    });
}

convertBtn.addEventListener('click', () => {
    const format = outputFormatSelect.value;
    const baseName = currentFile.name.split('.')[0];
    const newName = `${baseName}_converted.${format}`;
    
    try {
        if (format === 'json') {
            downloadBlob(JSON.stringify(currentData, null, 2), newName, 'application/json');
        } else if (format === 'csv') {
            downloadBlob(Papa.unparse(currentData), newName, 'text/csv');
        } else if (format === 'xml') {
            const xml = '<?xml version="1.0" encoding="UTF-8"?>\n' + x2js.json2xml_str({ root: { item: currentData } });
            downloadBlob(xml, newName, 'application/xml');
        } else if (format === 'xlsx') {
            const ws = XLSX.utils.json_to_sheet(currentData);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "FileSwap");
            XLSX.writeFile(wb, newName);
        }
        showStatus('Sucesso!', 'success');
    } catch (e) {
        showStatus('Erro na conversão: ' + e.message, 'error');
    }
});

function downloadBlob(content, name, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
}

function showStatus(msg, type) {
    statusMessage.textContent = msg;
    statusMessage.className = `status ${type}`;
    statusMessage.style.display = msg ? 'block' : 'none';
}

function resetUI() {
    currentFile = null;
    currentData = null;
    workbook = null;
    fileNameDisplay.textContent = 'Arraste um arquivo ou clique para buscar';
    outputFormatSelect.disabled = true;
    convertBtn.disabled = true;
    previewContainer.style.display = 'none';
    sheetSelectorContainer.style.display = 'none';
    dropZoneCard.className = 'upload-card';
}