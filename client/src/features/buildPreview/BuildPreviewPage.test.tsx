// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import BuildPreviewPage from './BuildPreviewPage';
vi.mock('../../auth/useAuth',()=>({useAuth:()=>({user:{catAppearance:'mochi-orange'}})}));
afterEach(()=>{cleanup();vi.restoreAllMocks();});
function load(state: string) { fireEvent.change(screen.getByLabelText('Reproducible review state'),{target:{value:state}}); }
describe('development placement sandbox',()=>{
  it('places, selects, moves/removes, rejects collisions and resets on remount without writes/storage',()=>{
    const fetch=vi.spyOn(globalThis,'fetch');
    const local=vi.spyOn(Storage.prototype,'setItem');
    const view=render(<BuildPreviewPage />);
    expect(screen.getByRole('img',{name:'Orange Mochi at Home position'})).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button',{name:'Place / move at floor node'}));
    expect(screen.getByText('1/28 development safety cap. Wall and floor occupancy are independent. No tabletop placement.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button',{name:'New placement'}));
    fireEvent.click(screen.getByRole('button',{name:'Place / move at floor node'}));
    expect(screen.getByRole('status')).toHaveTextContent('overlaps');
    fireEvent.click(screen.getByRole('button',{name:/1: Cushioned Cat Bed/}));
    fireEvent.keyDown(screen.getByRole('button',{name:/1: Cushioned Cat Bed/}),{key:'ArrowLeft'});
    fireEvent.click(screen.getByRole('button',{name:'Remove selected'}));
    expect(screen.getByText('No placed objects')).toBeInTheDocument();
    load('Sparse 16'); expect(screen.getByLabelText('Floor lattice')).toHaveValue('16');
    expect(fetch).not.toHaveBeenCalled(); expect(local).not.toHaveBeenCalled();
    view.unmount();render(<BuildPreviewPage />);
    expect(screen.getByText('No placed objects')).toBeInTheDocument();
  });
  it('renders unmirrored wall comparison and local verdicts independently from placement',()=>{
    render(<BuildPreviewPage />);load('Left wall');
    expect(screen.getByLabelText('Wall preview / placement plane')).toHaveValue('left');
    expect(screen.getByText(/Diagnostic ghost only/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Wall preview / placement plane'),{target:{value:'right'}});
    fireEvent.change(screen.getByLabelText('Observed native perspective'),{target:{value:'right'}});
    expect(screen.getByRole('table')).toHaveTextContent('right');
    expect(document.querySelector('image[transform]')).toBeNull();
    expect(screen.getByText('No placed objects')).toBeInTheDocument();
  });
  it('exposes togglable debug/grid controls and repeatable base-depth scene ordering',()=>{
    render(<BuildPreviewPage />);load('Table in front of Mochi');
    const cat=document.querySelector('[data-cat-depth]')!;
    expect(Number(cat.nextElementSibling?.getAttribute('data-depth'))).toBeGreaterThan(Number(cat.getAttribute('data-depth')));
    load('Table behind Mochi');
    expect(Number(cat.previousElementSibling?.getAttribute('data-depth'))).toBeLessThan(Number(cat.getAttribute('data-depth')));
    fireEvent.click(screen.getByLabelText('Show isometric grid'));
    expect(document.querySelectorAll('line')).toHaveLength(0);
    fireEvent.click(screen.getByLabelText('Show selected bounds, anchors, occupied cells'));
    expect(document.querySelectorAll('circle')).toHaveLength(0);
  });
  it('clearly separates production floor review from experiments and enforces the frozen controls',()=>{
    render(<BuildPreviewPage />);
    fireEvent.click(screen.getByLabelText('Enforce production floor contract'));
    expect(screen.getByText(/PRODUCTION CONTRACT:/)).toBeInTheDocument();
    expect(screen.getByLabelText('Floor lattice')).toHaveValue('16');
    expect(screen.getByLabelText('Floor lattice')).toBeDisabled();
    expect(screen.getByLabelText('New item scale')).toBeDisabled();
    expect(screen.getByLabelText('Visual variant')).toHaveValue('decor_cat_bed_cushioned_blue');
    fireEvent.change(screen.getByLabelText('Floor node U'),{target:{value:11}});
    fireEvent.change(screen.getByLabelText('Floor node V'),{target:{value:12}});
    fireEvent.click(screen.getByRole('button',{name:'Place / move at floor node'}));
    expect(screen.getByRole('status')).toHaveTextContent('Mochi');
    expect(screen.getByText('No placed objects')).toBeInTheDocument();
    expect(screen.getByText('0/20 production floor cap. Mochi reservation enforced. No tabletop placement.')).toBeInTheDocument();
    load('Crowded');
    expect(screen.getByLabelText('Placed objects').querySelectorAll('button').length).toBeLessThanOrEqual(20);
  });

});
