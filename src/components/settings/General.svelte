<script lang="ts">
  import Group from './Group.svelte'
  import Field from '../ui/Field.svelte'
  import Segmented from '../ui/Segmented.svelte'
  import Icon from '../Icon.svelte'
  import { theme } from '$lib/stores/theme.svelte'
  import { ui } from '$lib/stores/ui.svelte'
  import { i18n, LOCALES, LOCALE_INFO, t, type Locale } from '$lib/i18n/index.svelte'
</script>

<!-- Language comes first: someone who cannot read the interface needs to find
     this without reading anything else. -->
<Group>
  <Field label={t('settings.language')} hint={t('settings.languageHint')} for="language-select">
    <select
      id="language-select"
      class="input"
      data-testid="language-select"
      value={i18n.locale}
      onchange={(e) => void i18n.setLocale(e.currentTarget.value as Locale)}
    >
      {#each LOCALES as locale (locale)}
        <option value={locale}>{LOCALE_INFO[locale].name}</option>
      {/each}
    </select>
  </Field>

  <Field label={t('settings.startSection')} hint={t('settings.startSectionHint')}>
    <Segmented
      label={t('settings.startSection')}
      value={theme.settings.startSection}
      options={[
        { value: 'home', label: t('nav.home'), icon: 'house' },
        { value: 'notes', label: t('nav.notes'), icon: 'notebook' },
      ]}
      onchange={(startSection) => theme.update({ startSection })}
    />
  </Field>
</Group>

<Group title={t('tour.settingsTitle')} description={t('tour.settingsHint')}>
  <div>
    <button class="btn" data-testid="replay-tour" onclick={() => (ui.tourOpen = true)}>
      <Icon name="compass" size={14} />{t('actions.tour')}
    </button>
  </div>
</Group>
