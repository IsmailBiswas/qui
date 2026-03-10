import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

const STORAGE_KEY = 'stop-it-bro-settings'

export type AIProvider = 'ollama' | 'openai' | 'custom'

export interface AISettings {
  provider: AIProvider
  baseUrl: string
  apiKey: string
  model: string
}

const PROVIDER_DEFAULTS: Record<AIProvider, Omit<AISettings, 'provider'>> = {
  ollama: {
    baseUrl: 'http://localhost:11434',
    apiKey: '',
    model: 'qwen2.5:3b',
  },
  openai: {
    baseUrl: 'https://api.openai.com/v1',
    apiKey: '',
    model: 'gpt-4o-mini',
  },
  custom: {
    baseUrl: '',
    apiKey: '',
    model: '',
  },
}

function loadSettings(): AISettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw) as AISettings
  } catch {
    // ignore
  }
  return { provider: 'ollama', ...PROVIDER_DEFAULTS.ollama }
}

export const useSettingsStore = defineStore('settings', () => {
  const saved = loadSettings()

  const provider = ref<AIProvider>(saved.provider)
  const baseUrl = ref(saved.baseUrl)
  const apiKey = ref(saved.apiKey)
  const model = ref(saved.model)
  const settingsOpen = ref(false)

  function openSettings() {
    settingsOpen.value = true
  }

  function closeSettings() {
    settingsOpen.value = false
  }

  function applyProviderDefaults(p: AIProvider) {
    provider.value = p
    const d = PROVIDER_DEFAULTS[p]
    baseUrl.value = d.baseUrl
    model.value = d.model
    // Don't wipe apiKey when switching providers — let user keep it
  }

  // Persist on every change
  watch([provider, baseUrl, apiKey, model], () => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          provider: provider.value,
          baseUrl: baseUrl.value,
          apiKey: apiKey.value,
          model: model.value,
        } satisfies AISettings)
      )
    } catch {
      // ignore
    }
  })

  return {
    provider,
    baseUrl,
    apiKey,
    model,
    settingsOpen,
    openSettings,
    closeSettings,
    applyProviderDefaults,
    PROVIDER_DEFAULTS,
  }
})
