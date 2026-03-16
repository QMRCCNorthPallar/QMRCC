document.addEventListener('DOMContentLoaded', () => {

    // --- CONFIGURATION ---
    // CHANGE THIS CODE to your desired secret access code.
    const SECRET_CODE = "letmein123"; 

    // --- DOM ELEMENTS ---
    const accessScreen = document.getElementById('access-screen');
    const appContainer = document.getElementById('app-container');
    const accessCodeInput = document.getElementById('access-code-input');
    const accessSubmitBtn = document.getElementById('access-submit-btn');
    const accessErrorMessage = document.getElementById('access-error-message');

    const templateUpload = document.getElementById('templateUpload');
    const payerNameInput = document.getElementById('payerName');
    const amountPaidInput = document.getElementById('amountPaid');
    const currencySelector = document.getElementById('currencySelector');
    const generateBtn = document.getElementById('generateBtn');
    const receiptImage = document.getElementById('receiptImage');
    const downloadBtn = document.getElementById('downloadBtn');
    const placeholderText = document.getElementById('placeholderText');
    const canvas = document.getElementById('receiptCanvas');
    const ctx = canvas.getContext('2d');
    const fileInputWrapper = document.querySelector('.file-input-wrapper');
    const fileInputLabel = document.querySelector('.file-input-label');
    
    let uploadedImage = null;

    // --- CURRENCY MAPPING ---
    const currencyMap = {
        'INR': { symbol: '₹', code: 'INR' },
        'AED': { symbol: 'د.إ', code: 'AED' },
        'SAR': { symbol: '﷼', code: 'SAR' }
    };

    // --- THEME TOGGLE LOGIC ---
    const toggleSwitch = document.querySelector('#checkbox');
    const currentTheme = localStorage.getItem('theme');
    if (currentTheme) {
        document.documentElement.setAttribute('data-theme', currentTheme);
        if (currentTheme === 'dark') {
            toggleSwitch.checked = true;
        }
    }

    function switchTheme(e) {
        if (e.target.checked) {
            document.documentElement.setAttribute('data-theme', 'dark');
            localStorage.setItem('theme', 'dark');
        } else {
            document.documentElement.setAttribute('data-theme', 'light');
            localStorage.setItem('theme', 'light');
        }
    }
    toggleSwitch.addEventListener('change', switchTheme);

    // --- ACCESS CONTROL LOGIC ---
    function grantAccess() {
        accessScreen.classList.add('hidden');
        appContainer.classList.remove('hidden');
        // Fade-in animation for the main app
        setTimeout(() => appContainer.classList.add('visible'), 10);
    }

    function denyAccess() {
        accessErrorMessage.textContent = 'Incorrect code. Please try again.';
        accessCodeInput.value = '';
        accessCodeInput.focus();
    }

    function checkAccess() {
        const enteredCode = accessCodeInput.value;
        if (enteredCode === SECRET_CODE) {
            grantAccess();
        } else {
            denyAccess();
        }
    }
    
    accessSubmitBtn.addEventListener('click', checkAccess);
    accessCodeInput.addEventListener('keyup', (event) => {
        if (event.key === 'Enter') {
            checkAccess();
        }
    });

    // --- MAIN APP LOGIC (runs after access is granted) ---

    // 1. Template file upload
    templateUpload.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (file && file.type === 'image/png') {
            const reader = new FileReader();
            reader.onload = (e) => {
                uploadedImage = new Image();
                uploadedImage.onload = () => {
                    fileInputLabel.textContent = file.name;
                    fileInputLabel.style.color = 'var(--text-primary)';
                };
                uploadedImage.src = e.target.result;
            };
            reader.readAsDataURL(file);
        } else {
            alert('Please upload a valid PNG image file.');
            uploadedImage = null;
            fileInputLabel.textContent = 'Choose file...';
            fileInputLabel.style.color = 'var(--text-secondary)';
        }
    });

    // 2. Generate Receipt button
    generateBtn.addEventListener('click', () => {
        if (!uploadedImage) {
            alert('Please upload a PNG template first.');
            return;
        }
        if (!payerNameInput.value || !amountPaidInput.value) {
            alert('Please fill in both the name and amount fields.');
            return;
        }

        // --- Show loading state ---
        generateBtn.classList.add('loading');
        generateBtn.disabled = true;

        // Use a timeout to allow the UI to update before the heavy lifting
        setTimeout(() => {
            // Set canvas dimensions
            canvas.width = uploadedImage.width;
            canvas.height = uploadedImage.height;

            // --- DRAWING LOGIC ---
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(uploadedImage, 0, 0);

            // Get values
            const name = payerNameInput.value;
            const amount = parseFloat(amountPaidInput.value).toFixed(2);
            const selectedCurrency = currencySelector.value;
            const { symbol, code } = currencyMap[selectedCurrency];

            // ==================== CUSTOMIZATION AREA ====================
            // Adjust font, size, color, and position to match your template.
            
            // --- Style for the "Name" text ---
            ctx.font = 'bold 28px Inter';
            ctx.fillStyle = '#1a1d23'; // A dark, soft black that works on light templates
            ctx.textAlign = 'left';
            ctx.fillText(`Name: ${name}`, 80, 280); 

            // --- Style for the "Amount" text ---
            ctx.font = 'bold 32px Inter';
            ctx.fillStyle = '#1a1d23';
            ctx.textAlign = 'left';
            ctx.fillText(`Amount: ${symbol} ${amount}`, 80, 350);
            // ===========================================================

            // --- Display the result ---
            const dataURL = canvas.toDataURL('image/png');
            receiptImage.src = dataURL;
            receiptImage.style.display = 'block';
            downloadBtn.href = dataURL;
            placeholderText.style.display = 'none';

            // --- Hide loading state ---
            generateBtn.classList.remove('loading');
            generateBtn.disabled = false;
        }, 500); // 500ms delay to show the spinner
    });

    // 3. Set a dynamic filename for the download link
    downloadBtn.addEventListener('click', (e) => {
        const name = payerNameInput.value || 'receipt';
        const currencyCode = currencySelector.value;
        e.target.download = `receipt_${name.replace(/\s+/g, '_')}_${currencyCode}.png`;
    });
});