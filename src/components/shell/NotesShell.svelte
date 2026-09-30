<script lang="ts">
  import Sidebar from '../Sidebar.svelte'
  import NoteList from '../NoteList.svelte'
  import NoteView from '../NoteView.svelte'
  import Resizer from './Resizer.svelte'
  import { theme } from '$lib/stores/theme.svelte'
  import { ui } from '$lib/stores/ui.svelte'
  import { t } from '$lib/i18n/index.svelte'

  interface Props {
    onopenpalette: () => void
  }

  let { onopenpalette }: Props = $props()

  // Widths follow the setting, but are overridden locally while dragging so a
  // resize does not write the settings row on every pointer move.
  let sidebarDrag = $state<number | null>(null)
  let listDrag = $state<number | null>(null)
  let sidebarWidth = $derived(sidebarDrag ?? theme.settings.sidebarWidth)
  let listWidth = $derived(listDrag ?? theme.settings.listWidth)
  let collapsed = $derived(theme.settings.sidebarCollapsed && !ui.narrow)
</script>

<div
  class="shell"
  class:shell--narrow={ui.narrow}
  class:shell--collapsed={collapsed}
  data-pane={ui.pane}
  style="--sidebar-w: {collapsed ? 0 : sidebarWidth}px; --list-w: {listWidth}px"
>
  <div class="pane pane--folders" inert={collapsed}>
    <Sidebar {onopenpalette} />
    {#if !ui.narrow && !collapsed}
      <Resizer
        value={sidebarWidth}
        min={180}
        max={400}
        label={t('nav.resizeSidebar')}
        oninput={(w) => (sidebarDrag = w)}
        onchange={(w) => {
          sidebarDrag = null
          theme.update({ sidebarWidth: w })
        }}
      />
    {/if}
  </div>
  <div class="pane pane--list">
    <NoteList />
    {#if !ui.narrow}
      <Resizer
        value={listWidth}
        min={240}
        max={520}
        label={t('nav.resizeList')}
        oninput={(w) => (listDrag = w)}
        onchange={(w) => {
          listDrag = null
          theme.update({ listWidth: w })
        }}
      />
    {/if}
  </div>
  <div class="pane pane--note">
    <NoteView />
  </div>
</div>

<style>
  .shell {
    display: grid;
    grid-template-columns: var(--sidebar-w) var(--list-w) minmax(0, 1fr);
    height: 100%;
    overflow: hidden;
    transition: grid-template-columns var(--dur-3) var(--ease-out);
  }

  .pane {
    position: relative;
    min-width: 0;
    min-height: 0;
  }

  .shell--collapsed .pane--folders {
    overflow: hidden;
  }

  /* Narrow layout: one pane at a time, driven by ui.pane. */
  .shell--narrow {
    grid-template-columns: 1fr;
    transition: none;
  }

  .shell--narrow .pane {
    display: none;
  }

  .shell--narrow[data-pane='folders'] .pane--folders,
  .shell--narrow[data-pane='list'] .pane--list,
  .shell--narrow[data-pane='note'] .pane--note {
    display: block;
    animation: pane-in var(--dur-2) var(--ease-out);
  }

  @keyframes pane-in {
    from {
      opacity: 0;
      transform: translateX(12px);
    }
  }

  :global([dir='rtl']) .shell--narrow .pane {
    animation-name: pane-in-rtl;
  }

  @keyframes pane-in-rtl {
    from {
      opacity: 0;
      transform: translateX(-12px);
    }
  }
</style>
