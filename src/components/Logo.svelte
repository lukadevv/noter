<script lang="ts">
  /**
   * The Noter mark, inline so it themes and never flashes while an image loads.
   * Generated from scripts/logo.mjs by scripts/gen-icons.mjs; edit the logo
   * there, not here.
   */
  interface Props {
    size?: number
    /** 'color' is the full logo; 'mono' draws the glyph in currentColor. */
    variant?: 'color' | 'mono'
  }

  let { size = 20, variant = 'color' }: Props = $props()
  const id = `logo-${Math.random().toString(36).slice(2, 8)}`
</script>

<svg class="logo logo--{variant}" width={size} height={size} viewBox="0 0 1024 1024" aria-hidden="true">
  {#if variant === 'color'}
    <defs>
      <linearGradient {id} x1="0" y1="0" x2="0.35" y2="1">
        <stop offset="0" stop-color="#a29fff" />
        <stop offset="1" stop-color="#5550da" />
      </linearGradient>
    </defs>
    <path
      d="M1000.0 512.0L999.6 675.9L998.3 728.1L996.2 765.8L993.3 796.2L989.5 821.9L984.8 844.3L979.2 864.1L972.7 881.8L965.3 897.8L956.8 912.1L947.4 925.1L936.8 936.8L925.1 947.4L912.1 956.8L897.8 965.3L881.8 972.7L864.1 979.2L844.3 984.8L821.9 989.5L796.2 993.3L765.8 996.2L728.1 998.3L675.9 999.6L512.0 1000.0L348.1 999.6L295.9 998.3L258.2 996.2L227.8 993.3L202.1 989.5L179.7 984.8L159.9 979.2L142.2 972.7L126.2 965.3L111.9 956.8L98.9 947.4L87.2 936.8L76.6 925.1L67.2 912.1L58.7 897.8L51.3 881.8L44.8 864.1L39.2 844.3L34.5 821.9L30.7 796.2L27.8 765.8L25.7 728.1L24.4 675.9L24.0 512.0L24.4 348.1L25.7 295.9L27.8 258.2L30.7 227.8L34.5 202.1L39.2 179.7L44.8 159.9L51.3 142.2L58.7 126.2L67.2 111.9L76.6 98.9L87.2 87.2L98.9 76.6L111.9 67.2L126.2 58.7L142.2 51.3L159.9 44.8L179.7 39.2L202.1 34.5L227.8 30.7L258.2 27.8L295.9 25.7L348.1 24.4L512.0 24.0L675.9 24.4L728.1 25.7L765.8 27.8L796.2 30.7L821.9 34.5L844.3 39.2L864.1 44.8L881.8 51.3L897.8 58.7L912.1 67.2L925.1 76.6L936.8 87.2L947.4 98.9L956.8 111.9L965.3 126.2L972.7 142.2L979.2 159.9L984.8 179.7L989.5 202.1L993.3 227.8L996.2 258.2L998.3 295.9L999.6 348.1Z"
      fill="url(#{id})"
    />
  {/if}
  <g stroke="var(--logo-bar, #fff)" stroke-width="96.0" stroke-linecap="round"
    ><line x1="272.0" y1="372.0" x2="676.0" y2="372.0" /><line
      x1="272.0"
      y1="512.0"
      x2="544.0"
      y2="512.0"
    /><line x1="272.0" y1="652.0" x2="608.0" y2="652.0" /></g
  ><circle cx="742.0" cy="652.0" r="58.0" fill="var(--logo-dot, #ffc857)" />
</svg>

<style>
  .logo {
    flex: none;
  }

  .logo--mono {
    --logo-bar: currentColor;
    --logo-dot: var(--accent);
  }
</style>
