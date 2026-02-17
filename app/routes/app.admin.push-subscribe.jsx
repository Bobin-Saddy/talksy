router.post('/app/admin/push-subscribe', async (req, res) => {
  const { shop, subscription } = req.body;

  if (!shop || !subscription?.endpoint || !subscription?.keys) {
    return res.status(400).json({ error: 'Missing shop or subscription data' });
  }

  try {
    await prisma.pushSubscription.upsert({
      where: { endpoint: subscription.endpoint },
      update: {
        shop,
        p256dh:    subscription.keys.p256dh,
        auth:      subscription.keys.auth,
        updatedAt: new Date()
      },
      create: {
        shop,
        endpoint: subscription.endpoint,
        p256dh:   subscription.keys.p256dh,
        auth:     subscription.keys.auth
      }
    });

    console.log(`✅ Push subscription saved for shop: ${shop}`);
    res.json({ success: true, message: 'Push subscription registered' });

  } catch (err) {
    console.error('Push subscribe error:', err);
    res.status(500).json({ error: 'Failed to save subscription' });
  }
});
