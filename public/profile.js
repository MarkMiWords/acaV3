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
}

function initProfilePage() {
  const profile = loadProfile();

  // Populate fields
  document.getElementById('author-pseudonym').value = profile.pseudonym;
  document.getElementById('partner-name').value = profile.partnerName;
  document.getElementById('partner-temperament').value = profile.temperament;

  // Set active toggles
  setActiveToggle('playback-voice', profile.playbackVoice);
  setActiveToggle('playback-accent', profile.accent);
  setActiveToggle('playback-pace', profile.pace);
  setActiveToggle('theme-select', profile.theme);

  // Apply theme
  applyTheme(profile.theme);

  // Text input listeners
  document.getElementById('author-pseudonym').addEventListener('input', (e) => {
    const p = loadProfile();
    p.pseudonym = e.target.value;
    saveProfile(p);
  });

  document.getElementById('partner-name').addEventListener('input', (e) => {
    const p = loadProfile();
    p.partnerName = e.target.value;
    saveProfile(p);
  });

  // Temperament slider
  document.getElementById('partner-temperament').addEventListener('input', (e) => {
    const p = loadProfile();
    p.temperament = parseInt(e.target.value, 10);
    saveProfile(p);
  });

  // Toggle groups
  initToggleGroup('playback-voice', 'playbackVoice');
  initToggleGroup('playback-accent', 'accent');
  initToggleGroup('playback-pace', 'pace');
  initToggleGroup('theme-select', 'theme', (value) => applyTheme(value));

  // Sync button
  document.getElementById('sync-profile-btn').addEventListener('click', () => {
    const p = loadProfile();
    saveProfile(p);
    window.location.href = '/';
  });
}

function setActiveToggle(groupId, value) {
  const group = document.getElementById(groupId);
  if (!group) return;
  group.querySelectorAll('.toggle-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.value === value);
  });
}

function initToggleGroup(groupId, profileKey, callback) {
  const group = document.getElementById(groupId);
  if (!group) return;

  group.querySelectorAll('.toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      group.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const p = loadProfile();
      p[profileKey] = btn.dataset.value;
      saveProfile(p);

      if (callback) callback(btn.dataset.value);
    });
  });
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
}

window.addEventListener('DOMContentLoaded', initProfilePage);
