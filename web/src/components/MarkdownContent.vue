<script setup lang="ts">
import { computed } from 'vue'
import { marked } from 'marked'
import DOMPurify from 'dompurify'

const props = defineProps<{ content: string }>()

// Configure marked for clean output
marked.setOptions({ breaks: true })

const html = computed(() =>
  DOMPurify.sanitize(marked.parse(props.content) as string)
)
</script>

<template>
  <div class="markdown-content" v-html="html" />
</template>

<style>
.markdown-content {
  font-size: 0.75rem;
  line-height: 1.6;
  color: inherit;
}
.markdown-content > * + * { margin-top: 0.65em; }
.markdown-content h1,
.markdown-content h2,
.markdown-content h3,
.markdown-content h4 {
  font-weight: 600;
  line-height: 1.3;
  margin-top: 1em;
  margin-bottom: 0.35em;
  color: oklch(0.97 0 0);
}
.markdown-content h1 { font-size: 1rem; }
.markdown-content h2 { font-size: 0.875rem; }
.markdown-content h3 { font-size: 0.8125rem; }
.markdown-content p { margin: 0; }
.markdown-content p + p { margin-top: 0.5em; }
.markdown-content ul,
.markdown-content ol {
  padding-left: 1.25em;
  margin: 0.4em 0;
}
.markdown-content li + li { margin-top: 0.2em; }
.markdown-content code {
  font-family: ui-monospace, 'Cascadia Code', monospace;
  font-size: 0.7rem;
  background: rgba(255,255,255,0.07);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 3px;
  padding: 0.1em 0.35em;
}
.markdown-content pre {
  background: rgba(0,0,0,0.35);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 6px;
  padding: 0.75em 1em;
  overflow-x: auto;
  margin: 0.5em 0;
}
.markdown-content pre code {
  background: none;
  border: none;
  padding: 0;
  font-size: 0.6875rem;
}
.markdown-content blockquote {
  border-left: 2px solid rgba(255,255,255,0.2);
  padding-left: 0.75em;
  color: rgba(255,255,255,0.5);
  margin: 0.5em 0;
}
.markdown-content strong { font-weight: 600; }
.markdown-content em { font-style: italic; }
.markdown-content a {
  color: hsl(var(--primary));
  text-decoration: underline;
  text-underline-offset: 2px;
}
.markdown-content hr {
  border: none;
  border-top: 1px solid rgba(255,255,255,0.1);
  margin: 0.75em 0;
}
.markdown-content table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.7rem;
}
.markdown-content th,
.markdown-content td {
  border: 1px solid rgba(255,255,255,0.1);
  padding: 0.3em 0.6em;
  text-align: left;
}
.markdown-content th { background: rgba(255,255,255,0.06); font-weight: 600; }
</style>
