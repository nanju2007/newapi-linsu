import React, { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { API, showError, showSuccess } from '../../helpers';
import SubscriptionPlansCard from '../../components/topup/SubscriptionPlansCard';

const UserSubscription = () => {
  const { t } = useTranslation();

  const [loading, setLoading] = useState(false);
  const [plans, setPlans] = useState([]);
  const [activeSubscriptions, setActiveSubscriptions] = useState([]);
  const [allSubscriptions, setAllSubscriptions] = useState([]);
  const [billingPreference, setBillingPreference] = useState('subscription_first');

  const [payMethods, setPayMethods] = useState([]);
  const [enableOnlineTopUp, setEnableOnlineTopUp] = useState(false);
  const [enableStripeTopUp, setEnableStripeTopUp] = useState(false);
  const [enableCreemTopUp, setEnableCreemTopUp] = useState(false);

  const loadPlans = useCallback(async () => {
    setLoading(true);
    try {
      const res = await API.get('/api/subscription/plans');
      if (res.data?.success) {
        setPlans(res.data.data || []);
      }
    } catch (e) {
      setPlans([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadSelf = useCallback(async () => {
    try {
      const res = await API.get('/api/subscription/self');
      if (res.data?.success) {
        setBillingPreference(
          res.data.data?.billing_preference || 'subscription_first',
        );
        setActiveSubscriptions(res.data.data?.subscriptions || []);
        setAllSubscriptions(res.data.data?.all_subscriptions || []);
      }
    } catch (e) {
      // ignore
    }
  }, []);

  const loadPayInfo = useCallback(async () => {
    try {
      const res = await API.get('/api/user/topup/info');
      const { data, success } = res.data || {};
      if (!success || !data) return;
      let methods = data.pay_methods || [];
      try {
        if (typeof methods === 'string') {
          methods = JSON.parse(methods);
        }
      } catch (e) {
        methods = [];
      }
      setPayMethods(Array.isArray(methods) ? methods : []);
      setEnableOnlineTopUp(data.enable_online_topup || false);
      setEnableStripeTopUp(data.enable_stripe_topup || false);
      setEnableCreemTopUp(data.enable_creem_topup || false);
    } catch (e) {
      // ignore
    }
  }, []);

  const onChangeBillingPreference = useCallback(
    async (pref) => {
      const prev = billingPreference;
      setBillingPreference(pref);
      try {
        const res = await API.put('/api/subscription/self/preference', {
          billing_preference: pref,
        });
        if (res.data?.success) {
          showSuccess(t('更新成功'));
          setBillingPreference(
            res.data?.data?.billing_preference || pref || prev,
          );
        } else {
          showError(res.data?.message || t('更新失败'));
          setBillingPreference(prev);
        }
      } catch (e) {
        showError(t('请求失败'));
        setBillingPreference(prev);
      }
    },
    [billingPreference, t],
  );

  useEffect(() => {
    loadPlans();
    loadSelf();
    loadPayInfo();
  }, [loadPlans, loadSelf, loadPayInfo]);

  return (
    <div className='p-3 sm:p-4 lg:p-6'>
      <SubscriptionPlansCard
        t={t}
        loading={loading}
        plans={plans}
        payMethods={payMethods}
        enableOnlineTopUp={enableOnlineTopUp}
        enableStripeTopUp={enableStripeTopUp}
        enableCreemTopUp={enableCreemTopUp}
        billingPreference={billingPreference}
        onChangeBillingPreference={onChangeBillingPreference}
        activeSubscriptions={activeSubscriptions}
        allSubscriptions={allSubscriptions}
        reloadSubscriptionSelf={loadSelf}
        withCard={true}
      />
    </div>
  );
};

export default UserSubscription;
