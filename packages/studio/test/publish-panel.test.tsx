import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PublishPanel, type PublishPanelRequest } from '../src/components/fb/publishUi';

function request(state: string): PublishPanelRequest {
  return {
    id: 7,
    state,
    content_hash: 'abc123hash',
    payload: { message: '今天的一句', media: [] },
    check_report: [{ rule: 'chars', level: 'pass', message: '字數可以', location: 'message' }],
  };
}

afterEach(() => cleanup());

describe('粉專發文面板', () => {
  it('非核准者看不到核准鈕', () => {
    render(
      <PublishPanel
        canApprove={false}
        mode="off"
        request={request('pending_approval')}
      />,
    );
    expect(screen.queryByRole('button', { name: '核准' })).toBeNull();
    expect(screen.queryByRole('button', { name: '確認核准' })).toBeNull();
    expect(screen.queryByRole('button', { name: '發布到粉專' })).toBeNull();
  });

  it('發布按鈕送出後立刻停用，連點只送一次', () => {
    const onPublish = vi.fn();
    render(
      <PublishPanel
        canApprove
        mode="dry_run"
        request={request('approved')}
        onPublish={onPublish}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: '發布到粉專' }));
    const confirm = screen.getByRole('button', { name: '確認發布' });
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    expect(onPublish).toHaveBeenCalledTimes(1);
    expect((confirm as HTMLButtonElement).disabled).toBe(true);
  });

  it('unknown 只有對帳，沒有重發', () => {
    const onReconcile = vi.fn();
    const onPublish = vi.fn();
    const onSubmit = vi.fn();
    render(
      <PublishPanel
        canApprove
        mode="fake"
        request={request('unknown')}
        onReconcile={onReconcile}
        onPublish={onPublish}
        onSubmit={onSubmit}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: '對帳' }));
    expect(onReconcile).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: /重發|重試|再送/ })).toBeNull();
    expect(screen.queryByRole('button', { name: '發布到粉專' })).toBeNull();
    expect(screen.queryByRole('button', { name: '確認發布' })).toBeNull();
    expect(screen.queryByRole('button', { name: '送審' })).toBeNull();
    expect(onPublish).not.toHaveBeenCalled();
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByTestId('publish-mode').textContent).toContain('fake');
  });
});
