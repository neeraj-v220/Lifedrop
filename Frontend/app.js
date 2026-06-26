const API_BASE = "https://lifedrop-backend-6km9.onrender.com/api";
// Helper to show messages
function showMessage(elementId, text, isError = false) {
    const el = document.getElementById(elementId);
    if (!el) return;
    el.style.display = 'block'; // Reset display to block so it shows up again
    el.textContent = text;
    el.className = `message ${isError ? 'error' : 'success'}`;
    setTimeout(() => {
        el.style.display = 'none';
    }, 5000);
}

// Location Dropdown Setup
function setupLocationDropdowns(stateId, districtId, cityId) {
    const stateSelect = document.getElementById(stateId);
    const districtSelect = document.getElementById(districtId);
    const citySelect = document.getElementById(cityId);

    if (!stateSelect || !districtSelect || !citySelect || typeof locationData === 'undefined') return;

    Object.keys(locationData).forEach(state => {
        const option = document.createElement('option');
        option.value = state;
        option.textContent = state;
        stateSelect.appendChild(option);
    });

    stateSelect.addEventListener('change', function() {
        districtSelect.innerHTML = '<option value="" disabled selected>Select District</option>';

        if (this.value) {
            districtSelect.disabled = false;
            Object.keys(locationData[this.value]).forEach(district => {
                const option = document.createElement('option');
                option.value = district;
                option.textContent = district;
                districtSelect.appendChild(option);
            });
        } else {
            districtSelect.disabled = true;
        }
    });

    // We no longer populate citySelect automatically because it's a manual input
}

// Init locations
setupLocationDropdowns('state', 'district', 'city');
setupLocationDropdowns('searchState', 'searchDistrict', 'searchCity');
setupLocationDropdowns('reqState', 'reqDistrict', 'reqCity');

// Location fetching
let donorLat = null;
let donorLng = null;

if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
        (pos) => {
            donorLat = pos.coords.latitude;
            donorLng = pos.coords.longitude;
        },
        (err) => console.warn("Geolocation denied or error:", err)
    );
}

// Donor Registration
const registerForm = document.getElementById("registerForm");
const registerBtn = document.getElementById("registerBtn");
const sendOtpBtn = document.getElementById("sendOtpBtn");
const otpSection = document.getElementById("otpSection");
const verifyOtpBtn = document.getElementById("verifyOtpBtn");
const otpInput = document.getElementById("otpInput");
const otpErrorMsg = document.getElementById("otpErrorMsg");

if (registerForm) {
    let pendingDonorData = null;
    let isPhoneVerified = false;

    // 1. Send OTP logic decoupled from form!
    if(sendOtpBtn) {
       sendOtpBtn.addEventListener("click", async () => {
    const phoneInput = registerForm.querySelector('input[name="phone"]').value;

    if (!phoneInput || phoneInput.length < 10) {
        return showMessage("registerMessage", "Enter a valid phone number first", true);
    }

    try {
        const originalText = sendOtpBtn.innerHTML;
        sendOtpBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        sendOtpBtn.disabled = true;

        const otpResponse = await fetch(`${API_BASE}/auth/send-otp`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ phone: phoneInput })
        });

        const otpResult = await otpResponse.json();

        if (otpResponse.ok) {
            if (otpResult.otp) {
                alert(`LifeDrop OTP:\n${otpResult.otp}`);
            }

            showMessage("registerMessage", "OTP generated successfully!", false);
            otpSection.style.display = "block";
            sendOtpBtn.innerHTML = '<i class="fas fa-check"></i> Sent';

        } else {
            const dummyOtp = Math.floor(100000 + Math.random() * 900000);
            alert(`Fallback OTP: ${dummyOtp}`);
            window.generatedFallbackOTP = dummyOtp;

            otpSection.style.display = "block";
            showMessage("registerMessage", "Using fallback OTP system", false);
            sendOtpBtn.innerHTML = '<i class="fas fa-check"></i> Sent';
        }

    } catch (err) {
        console.error(err);
        showMessage("registerMessage", "Network error while sending OTP", true);
        sendOtpBtn.disabled = false;
    }
});
    }

    // 2. Verify OTP decoupled
   if (verifyOtpBtn) {
    verifyOtpBtn.addEventListener("click", async () => {
        const phoneInput = registerForm.querySelector('input[name="phone"]').value;
        const otp = otpInput.value;

        if (!otp) {
            otpErrorMsg.textContent = "Please enter the 6-digit OTP.";
            return;
        }

        try {
            verifyOtpBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
            verifyOtpBtn.disabled = true;
            otpErrorMsg.textContent = "";

            const verifyRes = await fetch(`${API_BASE}/auth/verify-otp`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ phone: phoneInput, otp })
            });

            if (!verifyRes.ok) {

                // fallback check
                if (window.generatedFallbackOTP && otp == window.generatedFallbackOTP) {
                    isPhoneVerified = true;

                    otpSection.style.display = "none";
                    sendOtpBtn.innerHTML = '<i class="fas fa-lock"></i> Verified';
                    sendOtpBtn.disabled = true;

                    registerForm.querySelector('input[name="phone"]').readOnly = true;

                    registerBtn.disabled = false;
                    registerBtn.style.opacity = '1';
                    registerBtn.innerHTML = '<i class="fas fa-user-plus" style="margin-right: 8px;"></i> Complete Registration';

                    return;
                }

                let errRes = {};
                try {
                    errRes = await verifyRes.json();
                } catch (e) {
                    errRes.message = "Invalid OTP";
                }

                otpErrorMsg.textContent = errRes.message || "Invalid OTP";

                verifyOtpBtn.innerHTML = '<i class="fas fa-check-circle" style="margin-right: 8px;"></i> Verify';
                verifyOtpBtn.disabled = false;
                return;
            }

            // success
            isPhoneVerified = true;

            otpSection.style.display = "none";
            sendOtpBtn.innerHTML = '<i class="fas fa-lock"></i> Verified';
            sendOtpBtn.disabled = true;

            registerForm.querySelector('input[name="phone"]').readOnly = true;

            registerBtn.disabled = false;
            registerBtn.style.opacity = '1';
            registerBtn.innerHTML = '<i class="fas fa-user-plus" style="margin-right: 8px;"></i> Complete Registration';

        } catch (err) {
            console.error(err);
            otpErrorMsg.textContent = "Error verifying OTP.";

            verifyOtpBtn.innerHTML = '<i class="fas fa-check-circle" style="margin-right: 8px;"></i> Verify';
            verifyOtpBtn.disabled = false;
        }
    });
}

    // 3. Main Form Submittal
    registerForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        
        if(!isPhoneVerified) {
             return showMessage("registerMessage", "You must verify your phone number first!", true);
        }

        const consentCheckbox = document.getElementById('consent');
        if (consentCheckbox && !consentCheckbox.checked) {
             return showMessage("registerMessage", "You must agree to the Terms and Privacy Policy to register.", true);
        }

        const data = {
            name: registerForm.querySelector('input[name="name"]').value,
            bloodGroup: registerForm.querySelector('select[name="bloodGroup"]').value,
            phone: registerForm.querySelector('input[name="phone"]').value,
            state: registerForm.querySelector('select[name="state"]').value,
            district: registerForm.querySelector('input[name="district"]') ? registerForm.querySelector('input[name="district"]').value : registerForm.querySelector('select[name="district"]').value,
            city: registerForm.querySelector('input[name="city"]').value,
            lastDonationDate: registerForm.querySelector('input[name="lastDonationDate"]').value,
            location: { latitude: donorLat, longitude: donorLng },
            consent: consentCheckbox ? consentCheckbox.checked : false
        };

        try {
            const originalText = registerBtn.innerHTML;
            registerBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Registering...';
            registerBtn.disabled = true;

            const regRes = await fetch(`${API_BASE}/donor/register`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data)
            });

            const regResult = await regRes.json();

            if (regRes.ok) {
                // Remove alert to use in-page success block
                registerForm.style.display = 'none';
                if(document.getElementById('registerSuccessBlock')) {
                    document.getElementById('registerSuccessBlock').style.display = 'block';
                }
                
                // Hide OTP section just in case
                otpSection.style.display = 'none';
                
                // Reset locks
                isPhoneVerified = false;
                registerForm.querySelector('input[name="phone"]').readOnly = false;
                sendOtpBtn.innerHTML = "Send OTP";
                sendOtpBtn.disabled = false;
                registerBtn.disabled = true;
                registerBtn.style.opacity = '0.6';
                registerBtn.innerHTML = '<i class="fas fa-lock" style="margin-right: 8px;"></i> Verify Phone to Register';
            } else {
                showMessage("registerMessage", regResult.message || "Failed to register.", true);
                registerBtn.innerHTML = originalText;
                registerBtn.disabled = false;
            }
        } catch (error) {
            console.error(error);
            showMessage("registerMessage", "Error during registration.", true);
            registerBtn.disabled = false;
        }
    });
}

// Search Donors
const searchForm = document.getElementById('searchForm');
if (searchForm) {
    searchForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const bloodGroupEl = document.getElementById('searchBloodGroup');
        const stateEl = document.getElementById('searchState');
        const districtEl = document.getElementById('searchDistrict');
        const cityEl = document.getElementById('searchCity');

        const bloodGroup = encodeURIComponent(bloodGroupEl ? bloodGroupEl.value : '');
        const state = encodeURIComponent(stateEl && stateEl.value ? stateEl.value : '');
        const district = encodeURIComponent(districtEl && districtEl.value ? districtEl.value : '');
        const city = encodeURIComponent(cityEl && cityEl.value ? cityEl.value : '');

        const resultsContainer = document.getElementById('resultsContainer');

        try {
            const btn = searchForm.querySelector('button');
            const originalText = btn.innerHTML;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Searching...';
            btn.disabled = true;

            resultsContainer.innerHTML = '';

            const response = await fetch(`${API_BASE}/donor/search?bloodGroup=${bloodGroup}&state=${state}&district=${district}&city=${city}`);

            if (response.ok) {
                const result = await response.json();
                const donors = result.data || result; // the backend returns { data: array }

                if (donors && donors.length > 0) {
                    donors.forEach(donor => {
                        const card = document.createElement('div');
                        card.className = 'donor-card';
                        let iconColor = donor.isOfficial ? 'var(--primary)' : 'var(--text)';
                        let officialBadge = donor.isOfficial ? '<span style="font-size: 0.7em; background: var(--primary); color: white; padding: 2px 6px; border-radius: 10px; margin-left: 8px;">Official DB</span>' : '';

                        card.innerHTML = `
                            <div class="donor-info">
                                <h3><i class="fas fa-user" style="margin-right: 8px; font-size: 0.9em; color:${iconColor}"></i>${donor.name} ${officialBadge}</h3>
                                <p><i class="fas fa-phone" style="margin-right: 8px; width: 14px;"></i>${donor.phone}</p>
                                <p><i class="fas fa-map-marker-alt" style="margin-right: 8px; width: 14px;"></i>${donor.city}, ${donor.district}, ${donor.state}</p>
                            </div>
                            <div class="donor-badge">
                                ${donor.bloodGroup}
                            </div>
                        `;
                        resultsContainer.appendChild(card);
                    });
                } else {
                    showMessage('searchMessage', 'No donors found in this location for this blood group.', true);
                }
            } else {
                showMessage('searchMessage', 'Error searching for donors.', true);
            }
        } catch (error) {
            console.error(error);
            showMessage('searchMessage', 'Network error.', true);
        } finally {
            const btn = searchForm.querySelector('button');
            btn.innerHTML = '<i class="fas fa-search" style="margin-right: 8px;"></i> Search Donors';
            btn.disabled = false;
        }
    });
}

// Request Blood
const requestForm = document.getElementById('requestForm');
if (requestForm) {
    requestForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const payload = {
            patientName: document.getElementById('patientName').value,
            bloodGroup: document.getElementById('reqBloodGroup').value,
            state: document.getElementById('reqState').value,
            district: document.getElementById('reqDistrict').value,
            city: document.getElementById('reqCity').value,
            hospital: document.getElementById('hospital').value,
            phone: document.getElementById('reqPhone').value
        };

        try {
            const btn = requestForm.querySelector('button');
            const originalText = btn.innerHTML;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Submitting...';
            btn.disabled = true;

            const response = await fetch(`${API_BASE}/request`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                requestForm.style.display = 'none';
                if(document.getElementById('requestSuccessBlock')) {
                    document.getElementById('requestSuccessBlock').style.display = 'block';
                }
            } else {
                showMessage('requestMessage', 'Failed to submit request. Please try again.', true);
            }
        } catch (error) {
            console.error(error);
            showMessage('requestMessage', 'Network error. Make sure server is running.', true);
        } finally {
            const btn = requestForm.querySelector('button');
            btn.innerHTML = '<i class="fas fa-paper-plane" style="margin-right: 8px;"></i> Submit Request';
            btn.disabled = false;
        }
    });


}

// User Signup
const signupForm = document.getElementById("signupForm");
if (signupForm) {
    signupForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const name = document.getElementById("name").value;
        const email = document.getElementById("email").value;
        const password = document.getElementById("password").value;
        
        try {
            const btn = signupForm.querySelector('button');
            const originalText = btn.innerHTML;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Signing up...';
            btn.disabled = true;
            
            const response = await fetch(`${API_BASE}/users/register`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name, email, password })
            });
            
            const data = await response.json();
            
            if (response.ok && data.success) {
                localStorage.setItem("token", data.token);
                localStorage.setItem("user", JSON.stringify({ id: data._id, name: data.name, email: data.email }));
                showMessage("responseMessage", "Signup successful! Redirecting...", false);
                setTimeout(() => {
                    window.location.href = "index.html";
                }, 2000);
            } else {
                showMessage("responseMessage", data.message || "Signup failed.", true);
                btn.innerHTML = originalText;
                btn.disabled = false;
            }
        } catch (err) {
            console.error(err);
            showMessage("responseMessage", "Network error. Make sure server is running.", true);
            const btn = signupForm.querySelector('button');
            btn.innerHTML = '<i class="fas fa-user-plus"></i> Sign Up';
            btn.disabled = false;
        }
    });
}

// User Login
const loginForm = document.getElementById("loginForm");
if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const email = document.getElementById("email").value;
        const password = document.getElementById("password").value;
        
        try {
            const btn = loginForm.querySelector('button');
            const originalText = btn.innerHTML;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Logging in...';
            btn.disabled = true;
            
            const response = await fetch(`${API_BASE}/users/login`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ email, password })
            });
            
            const data = await response.json();
            
            if (response.ok && data.success) {
                localStorage.setItem("token", data.token);
                localStorage.setItem("user", JSON.stringify({ id: data._id, name: data.name, email: data.email }));
                showMessage("responseMessage", "Login successful! Redirecting...", false);
                setTimeout(() => {
                    window.location.href = "index.html";
                }, 2000);
            } else {
                showMessage("responseMessage", data.message || "Invalid credentials.", true);
                btn.innerHTML = originalText;
                btn.disabled = false;
            }
        } catch (err) {
            console.error(err);
            showMessage("responseMessage", "Network error. Make sure server is running.", true);
            const btn = loginForm.querySelector('button');
            btn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Login';
            btn.disabled = false;
        }
    });
}

