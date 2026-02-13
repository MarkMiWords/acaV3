/**
 * ===================================================================
 * WRAP Profile - Settings & Identity
 * ===================================================================
 */

const PROFILE_KEY = 'forgeProfile';

const defaultProfile = {
  pseudonym: '',
  partnerName: 'Wrapp',
  temperament: 3,
  playbackVoice: 'female',
  accent: 'AU',
  pace: 'normal',
  theme: 'dark'
};

function loadProfile() {
  const saved = localStorage.getItem(PROFILE_KEY);
  return saved ? { ...defaultProfile, ...JSON.parse(saved) } : { ...defaultProfile };
}

function saveProfile(profile) {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  showSaveStatus();
}

function showSaveStatus() {
  const status = document.getElementById('save-status');
  if (status) {
    status.classList.remove('hidden');
    setTimeout(() => {
      status.classList.add('hidden');
    }, 3000);
  }
}

function collectProfileData() {
  const profile = loadProfile();
  
  profile.pseudonym = document.getElementById('author-pseudonym').value;
  profile.partnerName = document.getElementById('partner-name').value;
  profile.temperament = parseInt(document.getElementById('partner-temperament').value, 10);
  
  profile.playbackVoice = document.querySelector('#playback-voice .toggle-btn.active')?.dataset.value || profile.playbackVoice;
  profile.accent = document.querySelector('#playback-accent .toggle-btn.active')?.dataset.value || profile.accent;
  profile.pace = document.querySelector('#playback-pace .toggle-btn.active')?.dataset.value || profile.pace;
  profile.theme = document.querySelector('#theme-select .toggle-btn.active')?.dataset.value || profile.theme;
  
  return profile;
}

function initProfilePage() {
  const profile = loadProfile();

  // Populate fields
  if (document.getElementById('author-pseudonym')) document.getElementById('author-pseudonym').value = profile.pseudonym;
  if (document.getElementById('partner-name')) document.getElementById('partner-name').value = profile.partnerName;
  if (document.getElementById('partner-temperament')) document.getElementById('partner-temperament').value = profile.temperament;

  // Set active toggles
  setActiveToggle('playback-voice', profile.playbackVoice);
  setActiveToggle('playback-accent', profile.accent);
  setActiveToggle('playback-pace', profile.pace);
  setActiveToggle('theme-select', profile.theme);

  // Apply theme
  applyTheme(profile.theme);

  // Toggle group listeners (UI only, saving happens on button click)
  initToggleGroup('playback-voice');
  initToggleGroup('playback-accent');
  initToggleGroup('playback-pace');
  initToggleGroup('theme-select', (value) => applyTheme(value));

  // Save button
  const saveBtn = document.getElementById('save-profile-btn');
  if (saveBtn) {
    saveBtn.addEventListener('click', () => {
      const p = collectProfileData();
      saveProfile(p);
    });
  }

  // Save and Return button
  const syncBtn = document.getElementById('sync-profile-btn');
  if (syncBtn) {
    syncBtn.addEventListener('click', () => {
      const p = collectProfileData();
      saveProfile(p);
      window.location.href = '/';
    });
  }
}

function setActiveToggle(groupId, value) {
  const group = document.getElementById(groupId);
  if (!group) return;
  group.querySelectorAll('.toggle-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.value === value);
  });
}

function initToggleGroup(groupId, callback) {
  const group = document.getElementById(groupId);
  if (!group) return;

  group.querySelectorAll('.toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      group.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      if (callback) callback(btn.dataset.value);
    });
  });
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
}

window.addEventListener('DOMContentLoaded', initProfilePage);
