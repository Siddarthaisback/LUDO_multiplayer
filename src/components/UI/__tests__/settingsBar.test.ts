import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect, vi } from 'vitest';
import { SettingsBar } from '../SettingsBar';

describe('SettingsBar Accessibility & Controls Visibility', () => {
  it('renders prominent Settings button with clear accessible label', () => {
    const markup = renderToStaticMarkup(
      React.createElement(SettingsBar, {
        onRestart: vi.fn(),
        onHome: vi.fn(),
        onOpenRules: vi.fn(),
      })
    );

    expect(markup).toContain('aria-label="Open Match Settings"');
    expect(markup).toContain('Settings');
  });

  it('renders quick sound and rules action buttons with accessible attributes', () => {
    const markup = renderToStaticMarkup(
      React.createElement(SettingsBar, {
        onRestart: vi.fn(),
        onHome: vi.fn(),
        onOpenRules: vi.fn(),
      })
    );

    expect(markup).toContain('aria-label="Mute Game Audio"');
    expect(markup).toContain('aria-pressed="true"');
    expect(markup).toContain('aria-label="Open Rules Guide"');
    expect(markup).toContain('Rules');
  });

  it('conditionally renders Auto-Play button when onToggleAutoPlay handler is provided', () => {
    const withoutAuto = renderToStaticMarkup(
      React.createElement(SettingsBar, {
        onRestart: vi.fn(),
        onHome: vi.fn(),
        onOpenRules: vi.fn(),
      })
    );
    expect(withoutAuto).not.toContain('Auto:');

    const withAuto = renderToStaticMarkup(
      React.createElement(SettingsBar, {
        onRestart: vi.fn(),
        onHome: vi.fn(),
        onOpenRules: vi.fn(),
        isAutoPlay: true,
        onToggleAutoPlay: vi.fn(),
      })
    );
    expect(withAuto).toContain('Auto:');
    expect(withAuto).toContain('aria-label="Disable Auto-Play"');
    expect(withAuto).toContain('aria-pressed="true"');
  });
});
