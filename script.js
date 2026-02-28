const fileInput = document.getElementById('file-input');
const dropZone = document.getElementById('drop-zone');
const fileNameDisplay = document.getElementById('file-name');
const outputFormatSelect = document.getElementById('output-format');
const convertBtn = document.getElementById('convert-btn');
const statusMessage = document.getElementById('status-message');
const previewContainer = document.getElementById('preview-container');
const previewTable = document.getElementById('preview-table');

let currentFile = null;
let currentData = null; // Store parsed data for preview and conversion
const supportedFormats = ['csv', 'json', 'xml', 'xlsx'];
const x2js = new X2JS();

// Drag and drop events
['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, preventDefaults, false);
});

function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
}

['dragenter', 'dragover'].forEach(eventName => {
    dropZone.addEventListener(eventName, () => dropZone.classList.add('dragover'), false);
});

['dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, () => dropZone.classList.remove('dragover'), false);
});

dropZone.addEventListener('drop', (e) => {
    const dt = e.dataTransfer;
    const files = dt.files;
    if (files.length > 0) handleFile(files[0]);
});

fileInput.addEventListener('change', function() {
    if (this.files.length > 0) handleFile(this.files[0]);
});

async function handleFile(file) {
    const ext = file.name.split('.').pop().toLowerCase();
    
    if (!supportedFormats.includes(ext)) {
        showStatus('Formato de arquivo não suportado. Use CSV, JSON, XML ou XLSX.', 'error');
        resetUI();
        return;
    }

    currentFile = file;
    fileNameDisplay.textContent = file.name;
    showStatus('Lendo arquivo...', '');
    
    try {
        currentData = await fileToJson(file, ext);
        if (!currentData || (Array.isArray(currentData) && currentData.length === 0)) {
            throw new Error("O arquivo parece estar vazio ou em um formato inválido.");
        }
        
        generatePreview(currentData);
        setupOutputOptions(ext);
        
        outputFormatSelect.disabled = false;
        convertBtn.disabled = false;
        showStatus('Arquivo carregado com sucesso!', 'success');
    } catch (error) {
        console.error(error);
        showStatus(`Erro ao ler o arquivo: ${error.message}`, 'error');
        resetUI();
    }
}

function setupOutputOptions(inputExt) {
    outputFormatSelect.innerHTML = '';
    supportedFormats.forEach(format => {
        if (format !== inputExt) {
            const option = document.createElement('option');
            option.value = format;
            option.textContent = format.toUpperCase();
            outputFormatSelect.appendChild(option);
        }
    });
}

function generatePreview(data) {
    previewTable.innerHTML = '';
    
    // Normaliza os dados para preview (garante que seja um array de objetos)
    let rows = Array.isArray(data) ? data : [data];
    if (rows.length === 0) return;

    // Pega as primeiras 5 linhas
    const previewRows = rows.slice(0, 5);
    const headers = Object.keys(previewRows[0]);

    // Header
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    headers.forEach(h => {
        const th = document.createElement('th');
        th.textContent = h;
        headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    previewTable.appendChild(thead);

    // Body
    const tbody = document.createElement('tbody');
    previewRows.forEach(row => {
        const tr = document.createElement('tr');
        headers.forEach(h => {
            const td = document.createElement('td');
            td.textContent = row[h] !== undefined ? row[h] : '';
            tr.appendChild(td);
        });
        tbody.appendChild(tr);
    });
    previewTable.appendChild(tbody);
    
    previewContainer.style.display = 'block';
}

function resetUI() {
    currentFile = null;
    currentData = null;
    fileInput.value = '';
    fileNameDisplay.textContent = 'Clique para escolher ou arraste um arquivo';
    outputFormatSelect.innerHTML = '<option value="">Selecione o arquivo primeiro</option>';
    outputFormatSelect.disabled = true;
    convertBtn.disabled = true;
    previewContainer.style.display = 'none';
}

function showStatus(message, type) {
    statusMessage.textContent = message;
    statusMessage.className = 'status ' + type;
    statusMessage.style.display = message ? 'block' : 'none';
}

function downloadFile(content, fileName, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function downloadXLSX(workbook, fileName) {
    XLSX.writeFile(workbook, fileName);
}

async function readAsText(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = e => resolve(e.target.result);
        reader.onerror = () => reject(new Error("Falha na leitura do arquivo de texto."));
        reader.readAsText(file);
    });
}

async function readAsArrayBuffer(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = e => resolve(e.target.result);
        reader.onerror = () => reject(new Error("Falha na leitura do buffer do arquivo."));
        reader.readAsArrayBuffer(file);
    });
}

async function fileToJson(file, ext) {
    try {
        if (ext === 'json') {
            const text = await readAsText(file);
            return JSON.parse(text);
        }
        if (ext === 'csv') {
            const text = await readAsText(file);
            return new Promise((resolve, reject) => {
                Papa.parse(text, {
                    header: true,
                    skipEmptyLines: true,
                    complete: (results) => {
                        if (results.errors.length > 0) {
                            reject(new Error("Erro ao processar CSV: " + results.errors[0].message));
                        } else {
                            resolve(results.data);
                        }
                    },
                    error: (err) => reject(new Error(err))
                });
            });
        }
        if (ext === 'xml') {
            const text = await readAsText(file);
            const jsonObj = x2js.xml_str2json(text);
            if (!jsonObj) throw new Error("Estrutura XML inválida.");
            
            // Tenta simplificar a estrutura
            const keys = Object.keys(jsonObj);
            if (keys.length === 1 && Array.isArray(jsonObj[keys[0]])) return jsonObj[keys[0]];
            if (keys.length === 1 && typeof jsonObj[keys[0]] === 'object') {
                 const subKeys = Object.keys(jsonObj[keys[0]]);
                 if(subKeys.length === 1 && Array.isArray(jsonObj[keys[0]][subKeys[0]])) return jsonObj[keys[0]][subKeys[0]];
            }
            return jsonObj;
        }
        if (ext === 'xlsx') {
            const buffer = await readAsArrayBuffer(file);
            const workbook = XLSX.read(buffer, {type: 'array'});
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            return XLSX.utils.sheet_to_json(worksheet);
        }
    } catch (err) {
        throw new Error(err.message);
    }
}

function jsonToOutput(jsonObj, targetExt, originalName) {
    const baseName = originalName.substring(0, originalName.lastIndexOf('.'));
    const newName = `${baseName}.${targetExt}`;

    try {
        if (targetExt === 'json') {
            downloadFile(JSON.stringify(jsonObj, null, 2), newName, 'application/json');
        } 
        else if (targetExt === 'csv') {
            let data = Array.isArray(jsonObj) ? jsonObj : [jsonObj];
            const csv = Papa.unparse(data);
            downloadFile(csv, newName, 'text/csv;charset=utf-8;');
        }
        else if (targetExt === 'xml') {
            let rootObj = Array.isArray(jsonObj) ? { root: { row: jsonObj } } : { root: jsonObj };
            let xml = '<?xml version="1.0" encoding="UTF-8"?>\n' + x2js.json2xml_str(rootObj);
            downloadFile(xml, newName, 'application/xml');
        }
        else if (targetExt === 'xlsx') {
            let data = Array.isArray(jsonObj) ? jsonObj : [jsonObj];
            const worksheet = XLSX.utils.json_to_sheet(data);
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");
            downloadXLSX(workbook, newName);
        }
        showStatus('Conversão concluída com sucesso!', 'success');
    } catch (err) {
        showStatus('Erro ao converter os dados: ' + err.message, 'error');
    }
}

convertBtn.addEventListener('click', () => {
    if (!currentData || !currentFile) return;
    const targetExt = outputFormatSelect.value;
    showStatus('Convertendo...', '');
    jsonToOutput(currentData, targetExt, currentFile.name);
});