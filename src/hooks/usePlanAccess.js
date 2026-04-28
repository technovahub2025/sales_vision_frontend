import { useMemo } from 'react';
import { useWorkspace } from '../contexts/WorkspaceContext';

const PRO_FEATURES = new Set(['roadmap', 'auditLog']);

export function usePlanAccess() {
  const { activeWorkspace } = useWorkspace();

  return useMemo(() => {
    const plan = String(activeWorkspace?.plan || 'free').toLowerCase() === 'pro' ? 'pro' : 'free';
    const usage = activeWorkspace?.usage || null;
    const isPro = plan === 'pro';
    const canUseFeature = (featureKey) => (PRO_FEATURES.has(String(featureKey || '')) ? isPro : true);
    return { plan, usage, isPro, isFree: !isPro, canUseFeature };
  }, [activeWorkspace?.plan, activeWorkspace?.usage]);
}

