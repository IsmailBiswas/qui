<script setup lang="ts">
import { useSettingsStore, type AIProvider } from '@/stores/settings'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { onMounted, onUnmounted } from 'vue'

const settings = useSettingsStore()

// ─── Configurable scale-up origin ────────────────────────────────────────────
// Change SCALE_ORIGIN to control where the modal visually grows from.
// Common values: 'center' | 'bottom center' | 'bottom left' | 'top center'
const SCALE_ORIGIN = 'bottom center'
// ─────────────────────────────────────────────────────────────────────────────

const PROVIDERS: { value: AIProvider; label: string }[] = [
  { value: 'ollama', label: 'Ollama (local)' },
  { value: 'openai', label: 'OpenAI' },
  { value: 'custom', label: 'Custom (OpenAI-compatible)' },
]

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') settings.closeSettings()
}

onMounted(() => window.addEventListener('keydown', handleKeydown))
onUnmounted(() => window.removeEventListener('keydown', handleKeydown))
</script>

<template>
  <Teleport to="body">
    <Transition name="settings-scale">
      <div
        v-if="settings.settingsOpen"
        class="settings-modal fixed z-[60] inset-0 flex items-center justify-center pointer-events-none"
      >
        <!-- Backdrop -->
        <div
          class="absolute inset-0 bg-black/50 pointer-events-auto"
          @click="settings.closeSettings()"
        />

        <!-- Panel -->
        <div
          class="settings-panel relative pointer-events-auto w-[80%] h-[80vh] max-h-[80vh] rounded-lg border border-border bg-card shadow-2xl flex flex-col overflow-hidden"
          :style="{ transformOrigin: SCALE_ORIGIN }"
        >
          <!-- Header -->
          <div class="flex items-center justify-between px-5 py-3 border-b border-border shrink-0">
            <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">Settings</p>
            <Button variant="ghost" size="icon" class="h-6 w-6" @click="settings.closeSettings()">
              <span class="text-xs leading-none">x</span>
            </Button>
          </div>

          <!-- Body -->
          <div class="flex-1 overflow-auto px-5 py-5 space-y-6">

            <!-- AI Provider -->
            <section class="space-y-3">
              <p class="text-[11px] uppercase tracking-widest text-muted-foreground font-medium">AI Provider</p>
              <div class="flex gap-2 flex-wrap">
                <Button
                  v-for="p in PROVIDERS"
                  :key="p.value"
                  :variant="settings.provider === p.value ? 'default' : 'outline'"
                  size="sm"
                  @click="settings.applyProviderDefaults(p.value)"
                >
                  {{ p.label }}
                </Button>
              </div>
            </section>

            <Separator />

            <!-- Connection -->
            <section class="space-y-4">
              <p class="text-[11px] uppercase tracking-widest text-muted-foreground font-medium">Connection</p>

              <div class="space-y-1.5">
                <label class="text-xs text-muted-foreground">Base URL</label>
                <Input
                  v-model="settings.baseUrl"
                  placeholder="e.g. http://localhost:11434"
                  class="h-8 text-sm font-mono"
                />
                <p class="text-[10px] text-muted-foreground/60">
                  <template v-if="settings.provider === 'ollama'">Ollama API endpoint. Default: http://localhost:11434</template>
                  <template v-else-if="settings.provider === 'openai'">OpenAI-compatible base URL. The path /chat/completions will be appended.</template>
                  <template v-else>Full base URL of your OpenAI-compatible provider.</template>
                </p>
              </div>

              <div class="space-y-1.5">
                <label class="text-xs text-muted-foreground">
                  API Key
                  <span v-if="settings.provider === 'ollama'" class="text-muted-foreground/50 ml-1">(not required for local Ollama)</span>
                </label>
                <Input
                  v-model="settings.apiKey"
                  type="password"
                  placeholder="sk-..."
                  class="h-8 text-sm font-mono"
                />
              </div>

              <div class="space-y-1.5">
                <label class="text-xs text-muted-foreground">Model</label>
                <Input
                  v-model="settings.model"
                  :placeholder="settings.provider === 'ollama' ? 'e.g. qwen2.5:3b' : settings.provider === 'openai' ? 'e.g. gpt-4o-mini' : 'model name'"
                  class="h-8 text-sm font-mono"
                />
                <p class="text-[10px] text-muted-foreground/60">
                  The exact model identifier sent to the API.
                </p>
              </div>
            </section>

            <Separator />

            <!-- Keyboard shortcuts reference -->
            <section class="space-y-3">
              <p class="text-[11px] uppercase tracking-widest text-muted-foreground font-medium">Keyboard Shortcuts</p>
              <div class="grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs text-muted-foreground">
                <span>Open settings</span><span class="font-mono text-foreground">Shift + ,</span>
                <span>New question</span><span class="font-mono text-foreground">Shift + Space</span>
                <span>History</span><span class="font-mono text-foreground">Shift + H</span>
                <span>Ask sub-question</span><span class="font-mono text-foreground">Space</span>
                <span>Dismiss / back</span><span class="font-mono text-foreground">Esc</span>
              </div>
            </section>

          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
/*
  Scale-up animation.
  The transform-origin is set inline from SCALE_ORIGIN so the panel
  grows from whatever point you configure at the top of the <script>.
*/
.settings-scale-enter-active,
.settings-scale-leave-active {
  transition: opacity 0.25s ease;
}
.settings-scale-enter-from,
.settings-scale-leave-to {
  opacity: 0;
}

.settings-scale-enter-active .settings-panel,
.settings-scale-leave-active .settings-panel {
  transition: transform 0.3s cubic-bezier(0.34, 1.20, 0.64, 1), opacity 0.25s ease;
}
.settings-scale-enter-from .settings-panel,
.settings-scale-leave-to .settings-panel {
  transform: scaleY(0.05);
  opacity: 0;
}
</style>
