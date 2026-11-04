// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import PostEditor from '@/components/post/post-editor';
const api = vi.hoisted(() => ({ upload: vi.fn(), save: vi.fn(), push: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: api.push }) }));
vi.mock('@/lib/instagram/api', () => ({ instagram: { connection: async () => ({ connected: false }), save: api.save }, uploadPhoto: api.upload }));
vi.mock('@/lib/social/editorial-api', () => ({ generateEditorialText: vi.fn() }));
vi.mock('@/components/post/publish-dialog', () => ({ default: () => null }));
vi.mock('@/components/post/carousel-builder', () => ({ default: () => null }));
beforeEach(() => { vi.clearAllMocks(); vi.stubGlobal('confirm', vi.fn(() => false)); URL.createObjectURL = vi.fn(() => 'blob:prepared'); URL.revokeObjectURL = vi.fn(); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
it('keeps a successful photo dirty when the next upload fails, and previews the prepared JPEG', async () => {
  const prepared = new Blob(['jpeg'], { type: 'image/jpeg' });
  api.upload.mockResolvedValueOnce({ path: 'u/a.jpg', cropped: true, preview: prepared }).mockRejectedValueOnce(new Error('Deuxième photo refusée'));
  render(<PostEditor id={null} initialFormat="carrousel" />);
  fireEvent.change(screen.getByLabelText('Ajouter des photos'), { target: { files: [new File(['one'], 'a.png', { type: 'image/png' }), new File(['two'], 'b.png', { type: 'image/png' })] } });
  await screen.findByText('Deuxième photo refusée');
  expect(screen.getByText('Modifications non enregistrées')).toBeTruthy();
  expect(URL.createObjectURL).toHaveBeenCalledWith(prepared);
  expect(screen.getByAltText('Aperçu de la photo 1').getAttribute('src')).toBe('blob:prepared');
  const event = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(event);
  expect(event.defaultPrevented).toBe(true);
  cleanup();
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:prepared');
});
it('does not leave or discard a changed post when confirmation is refused', async () => {
  render(<PostEditor id={null} />);
  fireEvent.change(screen.getByLabelText('Légende'), { target: { value: 'Mon brouillon' } });
  fireEvent.click(screen.getByRole('button', { name: 'Annuler' }));
  expect(api.push).not.toHaveBeenCalled();
  expect(screen.getByLabelText('Légende')).toHaveProperty('value', 'Mon brouillon');
});
it('freezes editing while saving so the response cannot hide newer unsaved text', async () => {
  let resolve!: (v: unknown) => void;
  api.save.mockReturnValueOnce(new Promise((r) => { resolve = r; }));
  render(<PostEditor id={null} />);
  fireEvent.change(screen.getByLabelText('Légende'), { target: { value: 'Version sauvegardée' } });
  fireEvent.click(screen.getByRole('button', { name: 'Enregistrer' }));
  expect(screen.getByLabelText('Légende').closest('fieldset')?.disabled).toBe(true);
  resolve({ item: { id: 'saved', status: 'draft' } });
  await waitFor(() => expect(screen.getByText('Brouillon enregistré.')).toBeTruthy());
  expect(screen.getByLabelText('Légende').closest('fieldset')?.disabled).toBe(false);
});
