router.post('/app/admin/push-unsubscribe', async (req, res) => {
  const { shop, endpoint } = req.body;

  if (!shop || !endpoint) {
    return res.status(400).json({ error: 'Missing shop or endpoint' });
  }

  try {
    await prisma.pushSubscription.deleteMany({
      where: { shop, endpoint }
    });

    console.log(`🔕 Push subscription removed for shop: ${shop}`);
    res.json({ success: true });

  } catch (err) {
    console.error('Unsubscribe error:', err);
    res.status(500).json({ error: 'Failed to unsubscribe' });
  }
});