const token = localStorage.getItem('token');

if (!token) {
  window.location.href = 'index.html';
  throw new Error('Missing auth token');
}

let role = null;
try {
  const payload = JSON.parse(atob(token.split('.')[1]));
  role = payload.role;
} catch (err) {
  localStorage.removeItem('token');
  window.location.href = 'index.html';
  throw err;
}

if (role === 'normaluser') {
  window.location.href = 'dashboard.html';
}

if (role !== 'admin') {
  document.getElementById('sendSMSOption')?.setAttribute('style', 'display:none;');
  document.getElementById('sendEmailOption')?.setAttribute('style', 'display:none;');
}

async function loadAnnouncements(){
  const res = await fetch('/api/announcements', { headers: { Authorization: `Bearer ${token}`}});
  if(!res.ok) return console.error('Failed to load announcements', await res.text());
  const list = await res.json();
  const ul = document.getElementById('list');
  ul.innerHTML = '';
  list.forEach(a => {
    const li = document.createElement('li');
    li.innerHTML = `<strong>${a.title}</strong> — ${a.message} <small>by ${a.created_by_name || 'Unknown'} on ${new Date(a.created_at).toLocaleString()}</small>`;
    ul.appendChild(li);
  });
}

// Load members for SMS (admin only)
async function loadMembers() {
  if (role !== 'admin') return;
  
  try {
    const res = await fetch('/api/members', {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) throw new Error('Failed to load members');
    
    const members = await res.json();
    const select = document.getElementById('memberSelect');
    select.innerHTML = '<option value="">-- Select a member --</option>';
    
    members
      .filter(m => m.phone && m.phone.trim() !== '')
      .forEach(m => {
        const option = document.createElement('option');
        option.value = m.id;
        option.textContent = `${m.name} (${m.phone})`;
        select.appendChild(option);
      });
  } catch (err) {
    console.error('Failed to load members', err);
  }
}

// Show SMS section for admins
if (role === 'admin') {
  document.getElementById('adminSMSSection').style.display = 'block';
  loadMembers();
}

// Character counter for SMS
const smsMessageEl = document.getElementById('smsMessage');
if (smsMessageEl) {
  smsMessageEl.addEventListener('input', function() {
    const count = this.value.length;
    const charCountDiv = document.getElementById('smsCharCount');
    charCountDiv.textContent = `Characters: ${count} / 160`;
    if (count > 160) {
      charCountDiv.style.color = '#f44336';
    } else {
      charCountDiv.style.color = '#666';
    }
  });
}

// Send SMS button
document.getElementById('sendSMSBtn')?.addEventListener('click', async () => {
  const memberId = document.getElementById('memberSelect').value;
  const message = document.getElementById('smsMessage').value.trim();
  const statusDiv = document.getElementById('smsStatus');
  
  if (!memberId) {
    statusDiv.innerHTML = '<div class="error">Please select a member</div>';
    return;
  }
  
  if (!message) {
    statusDiv.innerHTML = '<div class="error">Please enter a message</div>';
    return;
  }
  
  if (message.length > 160) {
    statusDiv.innerHTML = '<div class="error">Message exceeds 160 characters</div>';
    return;
  }
  
  try {
    statusDiv.innerHTML = '<div class="status-info">Sending...</div>';
    
    const res = await fetch('/api/announcements/sms/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ memberId: parseInt(memberId), message })
    });
    
    const data = await res.json();
    
    if (res.ok) {
      statusDiv.innerHTML = `<div class="success">✓ ${data.message}</div>`;
      document.getElementById('smsMessage').value = '';
      document.getElementById('memberSelect').value = '';
      loadAnnouncements();
    } else {
      statusDiv.innerHTML = `<div class="error">✗ ${data.error}</div>`;
    }
  } catch (err) {
    console.error(err);
    statusDiv.innerHTML = '<div class="error">Error sending SMS</div>';
  }
});

document.getElementById('createBtn')?.addEventListener('click', async ()=>{
  const title = document.getElementById('title').value.trim();
  const message = document.getElementById('message').value.trim();
  const sendSMS = document.getElementById('sendSMS').checked;
  const sendEmail = document.getElementById('sendEmail').checked;
  const statusDiv = document.getElementById('createStatus');
  if(!title || !message) return alert('Title and message required');
  statusDiv.innerHTML = '<div class="status-info">Creating announcement...</div>';
  const res = await fetch('/api/announcements', {
    method:'POST',
    headers: { 'Content-Type':'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ title, message, sendSMSToMembers: sendSMS, sendEmailToMembers: sendEmail })
  });
  const data = await res.json().catch(() => ({}));
  if(!res.ok) {
    statusDiv.innerHTML = `<div class="error">✗ ${data.error || 'Failed to create announcement'}</div>`;
    return;
  }

  let statusMsg = '✓ Announcement created successfully';
  if (data.smsSummary?.attempted) {
    if (data.smsSummary.sent) {
      statusMsg += ` and SMS sent to ${data.smsSummary.recipients} member(s)`;
    } else {
      statusMsg += `. SMS sending status: ${data.smsSummary.error || 'unknown error'}`;
    }
  }
  if (data.emailSummary?.attempted) {
    if (data.emailSummary.sent) {
      statusMsg += ` and email sent to ${data.emailSummary.recipients} recipient(s)`;
    } else {
      statusMsg += `. Email sending status: ${data.emailSummary.error || 'unknown error'}`;
    }
  }
  statusDiv.innerHTML = `<div class="success">${statusMsg}</div>`;

  document.getElementById('title').value='';
  document.getElementById('message').value='';
  document.getElementById('sendSMS').checked=false;
  document.getElementById('sendEmail').checked=false;
  loadAnnouncements();
});

loadAnnouncements();
