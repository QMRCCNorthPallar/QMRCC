/**
 * QMRCC UI Components Library
 * Collection of utility functions for UI components across the QMRCC website
 */

// Initialize all UI components when document is loaded
document.addEventListener('DOMContentLoaded', () => {
  initSearchDropdowns();
  initStickyNavigation();
  setupMobileMenu();
  setupWhatsAppButtons();
  setupFormValidation();
  applyConsistentStyling();
});

/**
 * Google-style search dropdown initialization
 * Handles search type selection in search forms
 */
function initSearchDropdowns() {
  // Find all search dropdown toggles
  const dropdownToggles = document.querySelectorAll('.dropdown-toggle');
  
  if (!dropdownToggles.length) return;
  
  dropdownToggles.forEach(toggle => {
    const dropdown = toggle.closest('.search-dropdown');
    if (!dropdown) return;
    
    const menu = dropdown.querySelector('.dropdown-menu');
    const items = dropdown.querySelectorAll('.dropdown-item');
    const selectedText = dropdown.querySelector('.selected-option') || toggle.querySelector('span');
    const hiddenInput = dropdown.closest('form')?.querySelector('input[type="hidden"]');
    
    // Toggle dropdown visibility
    toggle.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      menu.classList.toggle('show');
    });
    
    // Handle dropdown item selection
    items.forEach(item => {
      item.addEventListener('click', () => {
        const value = item.getAttribute('data-value');
        const text = item.textContent.trim();
        
        // Update displayed text and hidden input
        if (selectedText) selectedText.textContent = text;
        if (hiddenInput) hiddenInput.value = value;
        
        // Close dropdown
        menu.classList.remove('show');
        
        // Optional: Focus search input if exists
        const searchInput = dropdown.closest('form')?.querySelector('input[type="text"], input[type="search"]');
        if (searchInput) searchInput.focus();
        
        // Dispatch custom event for other components
        document.dispatchEvent(new CustomEvent('searchOptionSelected', {
          detail: { value, text, dropdown }
        }));
      });
    });
  });
  
  // Close dropdowns when clicking outside
  document.addEventListener('click', (e) => {
    document.querySelectorAll('.dropdown-menu.show').forEach(openMenu => {
      const dropdown = openMenu.closest('.search-dropdown');
      if (!dropdown || !dropdown.contains(e.target)) {
        openMenu.classList.remove('show');
      }
    });
  });
}

/**
 * Toggle functionality for search options
 * @param {string} dropdownId - ID of the dropdown to toggle
 */
function toggleSearchOptions(dropdownId) {
  const dropdown = document.getElementById(dropdownId);
  if (dropdown) {
    const menu = dropdown.querySelector('.dropdown-menu');
    menu.classList.toggle('show');
  }
}

/**
 * WhatsApp button event handlers
 * Tracks click events and provides animation effects
 */
function setupWhatsAppButtons() {
  const whatsappButtons = document.querySelectorAll('a[href^="https://wa.me/"], .contact-btn');
  
  whatsappButtons.forEach(button => {
    // Add hover effect
    button.addEventListener('mouseenter', () => {
      button.style.transition = 'all 0.3s ease';
      button.style.transform = 'translateY(-3px)';
    });
    
    button.addEventListener('mouseleave', () => {
      button.style.transform = 'translateY(0)';
    });
    
    // Add click tracking
    button.addEventListener('click', (e) => {
      // Track WhatsApp button clicks - can integrate with analytics
      const isWhatsApp = button.href?.includes('wa.me') || 
                         button.classList.contains('contact-btn');
      
      if (isWhatsApp) {
        console.log('WhatsApp button clicked:', button.href || 'WhatsApp contact button');
        
        // Optional: Add animation effect on click
        button.classList.add('clicked');
        setTimeout(() => button.classList.remove('clicked'), 300);
      }
    });
  });
}

/**
 * Helper function for sticky navigation
 * Makes the navigation bar stick to top after scrolling
 */
function initStickyNavigation() {
  const header = document.querySelector('header.navigation');
  if (!header) return;
  
  const headerHeight = header.offsetHeight;
  const scrollThreshold = 100; // Start sticky effect after 100px scroll
  
  window.addEventListener('scroll', () => {
    const scrollPosition = window.scrollY;
    
    if (scrollPosition > scrollThreshold) {
      header.classList.add('sticky-header');
      document.body.style.paddingTop = `${headerHeight}px`;
      header.style.position = 'fixed';
      header.style.top = '0';
      header.style.left = '0';
      header.style.right = '0';
      header.style.zIndex = '1000';
      header.style.boxShadow = '0 2px 10px rgba(0,0,0,0.1)';
      header.style.transition = 'all 0.3s ease';
    } else {
      header.classList.remove('sticky-header');
      document.body.style.paddingTop = '0';
      header.style.position = '';
      header.style.boxShadow = '';
    }
  });
}

/**
 * Mobile responsive menu handling
 * Controls mobile menu behavior and animations
 */
function setupMobileMenu() {
  const menuToggle = document.querySelector('.navbar-toggler');
  const navbarCollapse = document.querySelector('.navbar-collapse');
  
  if (!menuToggle || !navbarCollapse) return;
  
  // Handle menu toggle
  menuToggle.addEventListener('click', () => {
    navbarCollapse.classList.toggle('show');
    
    if (navbarCollapse.classList.contains('show')) {
      document.body.style.overflow = 'hidden'; // Prevent scrolling when menu is open
      
      // Add animation to menu items
      const menuItems = navbarCollapse.querySelectorAll('.nav-item');
      menuItems.forEach((item, index) => {
        item.style.animation = `fadeInRight 0.3s forwards ${0.1 + index * 0.1}s`;
        item.style.opacity = '0';
      });
    } else {
      document.body.style.overflow = '';
    }
  });
  
  // Close mobile menu when clicking outside
  document.addEventListener('click', (e) => {
    if (navbarCollapse.classList.contains('show') && 
        !navbarCollapse.contains(e.target) && 
        !menuToggle.contains(e.target)) {
      navbarCollapse.classList.remove('show');
      document.body.style.overflow = '';
    }
  });
  
  // Handle submenu toggles in mobile view
  const dropdownToggleLinks = document.querySelectorAll('.dropdown-toggle');
  const screenWidth = window.innerWidth;
  
  if (screenWidth < 1200) { // Mobile breakpoint
    dropdownToggleLinks.forEach(link => {
      link.addEventListener('click', (e) => {
        if (screenWidth < 1200) { // Recheck in case of resize
          e.preventDefault();
          const dropdown = link.closest('.dropdown');
          const dropdownMenu = dropdown.querySelector('.dropdown-menu');
          
          // Toggle this dropdown
          dropdown.classList.toggle('show');
          dropdownMenu.classList.toggle('show');
          
          // Close other dropdowns
          document.querySelectorAll('.dropdown.show').forEach(openDropdown => {
            if (openDropdown !== dropdown) {
              openDropdown.classList.remove('show');
              openDropdown.querySelector('.dropdown-menu').classList.remove('show');
            }
          });
        }
      });
    });
  }
}

/**
 * Form validation helpers
 * Common validations and form submission handling
 */
function setupFormValidation() {
  const forms = document.querySelectorAll('form');
  
  forms.forEach(form => {
    const submitButton = form.querySelector('button[type="submit"]');
    
    // Add validation on form submission
    form.addEventListener('submit', (e) => {
      if (!validateForm(form)) {
        e.preventDefault();
        e.stopPropagation();
      }
      
      form.classList.add('was-validated');
    });
    
    // Add live validation on blur
    const inputs = form.querySelectorAll('input, select, textarea');
    inputs.forEach(input => {
      input.addEventListener('blur', () => {
        validateInput(input);
      });
      
      // Remove error message when user starts typing again
      input.addEventListener('input', () => {
        const errorElement = input.nextElementSibling;
        if (errorElement && errorElement.classList.contains('error-message')) {
          errorElement.remove();
        }
        input.classList.remove('is-invalid');
      });
    });
  });
}

/**
 * Validates all form inputs
 * @param {HTMLFormElement} form - Form to validate
 * @returns {boolean} - Whether form is valid
 */
function validateForm(form) {
  const inputs = form.querySelectorAll('input, select, textarea');
  let isValid = true;
  
  inputs.forEach(input => {
    if (!validateInput(input)) {
      isValid = false;
    }
  });
  
  return isValid;
}

/**
 * Validates a single form input
 * @param {HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement} input - Input to validate
 * @returns {boolean} - Whether input is valid
 */
function validateInput(input) {
  let isValid = true;
  let errorMessage = '';
  
  // Skip disabled or hidden inputs
  if (input.disabled || input.type === 'hidden') {
    return true;
  }
  
  // Required validation
  if (input.hasAttribute('required') && !input.value.trim()) {
    isValid = false;
    errorMessage = 'This field is required';
  }
  
  // Email validation
  if (input.type === 'email' && input.value.trim()) {
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(input.value)) {
      isValid = false;
      errorMessage = 'Please enter a valid email address';
    }
  }
  
  // Phone number validation (for Indian numbers)
  if (input.name === 'phone' || input.id === 'phone') {
    const phonePattern = /^[6-9]\d{9}$/;
    if (input.value.trim() && !phonePattern.test(input.value)) {
      isValid = false;
      errorMessage = 'Please enter a valid 10-digit phone number';
    }
  }
  
  // Age validation
  if (input.name === 'age' || input.id === 'age') {
    const age = parseInt(input.value);
    if (input.value.trim() && (isNaN(age) || age < 18 || age > 65)) {
      isValid = false;
      errorMessage = 'Age must be between 18 and 65';
    }
  }
  
  // Display or clear error message
  const existingError = input.nextElementSibling;
  if (existingError && existingError.classList.contains('error-message')) {
    existingError.remove();
  }
  
  if (!isValid) {
    input.classList.add('is-invalid');
    
    const errorElement = document.createElement('div');
    errorElement.className = 'error-message invalid-feedback';
    errorElement.textContent = errorMessage;
    input.after(errorElement);
  } else {
    input.classList.remove('is-invalid');
    input.classList.add('is-valid');
  }
  
  return isValid;
}

/**
 * Applies consistent styling across components
 * Ensures UI consistency across the site
 */
function applyConsistentStyling() {
  // Apply consistent button styling
  const buttons = document.querySelectorAll('.btn');
  buttons.forEach(button => {
    if (!button.classList.contains('btn-primary') && 
        !button.classList.contains('btn-secondary') && 
        !button.classList.contains('btn-success') &&
        !button.classList.contains('btn-outline-primary')) {
      button.classList.add('btn-primary');
    }
    
    // Ensure correct padding and border-radius
    button.style.borderRadius = button.classList.contains('rounded-circle') ? '50%' : '10px';
  });
  
  // Apply consistent card styling
  const cards = document.querySelectorAll('.card');
  cards.forEach(card => {
    card.style.borderRadius = '15px';
    card.style.overflow = 'hidden';
    card.style.boxShadow = '0 6px 15px rgba(0,0,0,0.1)';
    card.style.transition = 'transform 0.3s ease, box-shadow 0.3s ease';
    
    // Add hover effect
    card.addEventListener('mouseenter', () => {
      card.style.transform = 'translateY(-5px)';
      card.style.boxShadow = '0 12px 30px rgba(0,0,0,0.15)';
    });
    
    card.addEventListener('mouseleave', () => {
      card.style.transform = '';
      card.style.boxShadow = '0 6px 15px rgba(0,0,0,0.1)';
    });
  });
  
  // Apply consistent form styling
  const formControls = document.querySelectorAll('.form-control');
  formControls.forEach(input => {
    input.style.borderRadius = '10px';
    input.style.padding = '12px 15px';
  });
  
  // Apply responsive behavior to tables
  const tables = document.querySelectorAll('table');
  tables.forEach(table => {
    const wrapper = document.createElement('div');
    wrapper.className = 'table-responsive';
    table.parentNode.insertBefore(wrapper, table);
    wrapper.appendChild(table);
  });
}

// Utility function to create toast/alert messages
function showToastMessage(message, type = 'info', duration = 3000) {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <div class="toast-content">
      <span class="toast-message">${message}</span>
    </div>
  `;
  
  // Style the toast based on type
  const backgroundColor = type === 'success' ? '#51B56D' : 
                          type === 'error' ? '#dc3545' :
                          type === 'warning' ? '#ffc107' : '#17a2b8';
  
  Object.assign(toast.style, {
    position: 'fixed',
    bottom: '20px',
    right: '20px',
    backgroundColor: backgroundColor,
    color: 'white',
    padding: '15px 25px',
    borderRadius: '10px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
    zIndex: '9999',
    opacity: '0',
    transition: 'opacity 0.3s ease',
  });
  
  document.body.appendChild(toast);
  
  // Show the toast with animation
  setTimeout(() => {
    toast.style.opacity = '1';
  }, 10);
  
  // Auto-hide after duration
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => {
      document.body.removeChild(toast);
    }, 300);
  }, duration);
}

// Export functions for use in other scripts
window.QMRCCComponents = {
  initSearchDropdowns,
  toggleSearchOptions,
  setupWhatsAppButtons,
  initStickyNavigation,
  setupMobileMenu,
  setupFormValidation,
  validateForm,
  validateInput,
  applyConsistentStyling,
  showToastMessage
};
