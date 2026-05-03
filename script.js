// URL of your published Google Sheet CSV
const SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQ7fCbaazdSAU8waEDn0qOYpss-7d5o-biapcazP1XCWG4seaP9ZNujAFCbydUneYy3JMdYXf3bIVxo/pub?gid=2058940071&single=true&output=csv';

const APPLIED_KEY = 'stagedb_applied_list';

// Fallback / Example data structure for testing
const MOCK_DATA = [
    {
        "Timestamp": "2023-10-27 10:00:00",
        "Nom Entreprise": "Example Corp",
        "SiteWeb Entreprise": "https://example.com",
        "email": "contact@example.com",
        "Nom Recruteur": "Recruiter Name",
        "Description": "Internship Position",
        "Page LinkedIn": "https://linkedin.com"
    }
];

document.addEventListener('DOMContentLoaded', () => {
    if (!SHEET_CSV_URL || SHEET_CSV_URL.includes('YOUR_PUBLISHED_CSV_URL_HERE')) {
        console.warn('Please provide a valid SHEET_CSV_URL. Displaying mock data for demonstration.');
        renderData(MOCK_DATA);
    } else {
        fetchData();
    }

    // Event listener for checkboxes
    document.getElementById('table-body').addEventListener('change', (e) => {
        if (e.target.classList.contains('applied-checkbox')) {
            const rowId = e.target.dataset.rowId;
            const isChecked = e.target.checked;
            toggleAppliedStatus(rowId, isChecked, e.target.closest('tr'));
        }
    });
});

async function fetchData() {
    const loadingEl = document.getElementById('loading');
    const errorEl = document.getElementById('error');
    
    const proxies = [
        (url) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
        (url) => `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`,
        (url) => url
    ];

    for (const getProxyUrl of proxies) {
        try {
            const currentUrl = getProxyUrl(SHEET_CSV_URL);
            const response = await fetch(currentUrl);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            
            let csvText;
            if (currentUrl.includes('allorigins.win')) {
                const data = await response.json();
                csvText = data.contents;
            } else {
                csvText = await response.text();
            }

            if (csvText.startsWith('data:text/csv;base64,')) {
                const base64Data = csvText.split(',')[1];
                const binaryString = atob(base64Data);
                const bytes = new Uint8Array(binaryString.length);
                for (let i = 0; i < binaryString.length; i++) {
                    bytes[i] = binaryString.charCodeAt(i);
                }
                csvText = new TextDecoder('utf-8').decode(bytes);
            }

            if (csvText && csvText.includes(',')) {
                parseCSV(csvText);
                return;
            }
        } catch (error) {
            console.warn(`Proxy failed`, error);
        }
    }

    loadingEl.style.display = 'none';
    errorEl.style.display = 'block';
    errorEl.textContent = 'Error: Could not reach Google Sheets. All proxy attempts failed.';
}

function parseCSV(csvText) {
    Papa.parse(csvText, {
        header: true,
        skipEmptyLines: 'greedy',
        complete: (results) => {
            if (results.data && results.data.length > 0) {
                renderData(results.data);
            } else {
                renderError('The spreadsheet appears to be empty or formatted incorrectly.');
            }
        },
        error: (error) => {
            renderError('Error parsing CSV data: ' + error.message);
        }
    });
}

function renderError(msg) {
    const loadingEl = document.getElementById('loading');
    const errorEl = document.getElementById('error');
    loadingEl.style.display = 'none';
    errorEl.style.display = 'block';
    errorEl.textContent = msg;
}

function getAppliedList() {
    const list = localStorage.getItem(APPLIED_KEY);
    return list ? JSON.parse(list) : [];
}

function toggleAppliedStatus(rowId, isChecked, trElement) {
    let list = getAppliedList();
    if (isChecked) {
        if (!list.includes(rowId)) list.push(rowId);
        trElement.classList.add('applied');
    } else {
        list = list.filter(id => id !== rowId);
        trElement.classList.remove('applied');
    }
    localStorage.setItem(APPLIED_KEY, JSON.stringify(list));
}

function generateRowId(row) {
    // Generate a unique ID based on company name and email
    const name = (row['Nom Entreprise'] || '').trim().toLowerCase();
    const email = (row['email'] || '').trim().toLowerCase();
    const str = name + email;
    
    // btoa() only supports Latin1. We need to encode to UTF-8 first to handle accents.
    try {
        return btoa(unescape(encodeURIComponent(str)));
    } catch (e) {
        // Simple fallback: replace spaces and non-alphanumeric for safety
        return str.replace(/[^a-z0-9]/g, '_');
    }
}

function renderData(data) {
    const loadingEl = document.getElementById('loading');
    const tableBody = document.getElementById('table-body');
    const errorEl = document.getElementById('error');
    
    loadingEl.style.display = 'none';
    errorEl.style.display = 'none';
    tableBody.innerHTML = '';

    const appliedList = getAppliedList();

    data.forEach((row) => {
        const tr = document.createElement('tr');
        const rowId = generateRowId(row);
        
        const isApplied = appliedList.includes(rowId);
        if (isApplied) tr.classList.add('applied');

        // Status Checkbox Column
        const statusTd = document.createElement('td');
        statusTd.className = 'status-cell';
        statusTd.innerHTML = `<input type="checkbox" class="applied-checkbox" data-row-id="${rowId}" ${isApplied ? 'checked' : ''}>`;
        tr.appendChild(statusTd);

        // Data Columns
        const columns = ['email', 'Nom Entreprise', 'SiteWeb Entreprise', 'Nom Recruteur', 'Description', 'Page LinkedIn'];

        columns.forEach(col => {
            const td = document.createElement('td');
            const actualKey = Object.keys(row).find(k => {
                const nk = k.trim().toLowerCase();
                const nc = col.trim().toLowerCase();
                return nk === nc || nk.includes(nc);
            });

            let value = actualKey ? row[actualKey] : '-';
            value = (value && value.trim()) ? value : '-';
            
            if (value !== '-' && (col === 'SiteWeb Entreprise' || col === 'Page LinkedIn' || value.startsWith('http'))) {
                const url = value.startsWith('http') ? value : `https://${value}`;
                td.innerHTML = `<a href="${url}" target="_blank" rel="noopener noreferrer">Link</a>`;
            } else if (value !== '-' && (col === 'email' || value.includes('@'))) {
                td.innerHTML = `<a href="mailto:${value}">${value}</a>`;
            } else {
                td.textContent = value;
            }
            tr.appendChild(td);
        });

        tableBody.appendChild(tr);
    });
}
