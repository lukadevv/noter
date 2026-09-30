<script lang="ts">
  import Icon from '../Icon.svelte'

  interface Props {
    name: string
    /** CSS colour; the badge is a tint of it. */
    color?: string
    size?: number
    /** Round instead of a rounded square. */
    round?: boolean
  }

  let { name, color = 'var(--accent)', size = 36, round = false }: Props = $props()
</script>

<span class="badge" class:round style="--c: {color}; width: {size}px; height: {size}px" aria-hidden="true">
  <Icon {name} size={Math.round(size * 0.46)} />
</span>

<style>
  .badge {
    display: grid;
    place-items: center;
    flex: none;
    border-radius: calc(var(--radius) + 2px);
    background: color-mix(in oklab, var(--c) 16%, transparent);
    color: var(--c);
    box-shadow: 0 0 0 1px color-mix(in oklab, var(--c) 22%, transparent) inset;
  }

  .round {
    border-radius: 50%;
  }
</style>
