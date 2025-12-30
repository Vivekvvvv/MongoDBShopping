function generateLogisticsTraces(origin, destination) {
  const traces = [];
  const currentTime = new Date();

  // 订单已揽收
  traces.push({
    time: new Date(currentTime.getTime() - 2 * 24 * 60 * 60 * 1000), // 2天前
    location: `${origin.city}${origin.district}`,
    description: '您的订单已被快递员揽收',
    status: '已揽收'
  });

  // 到达转运中心
  traces.push({
    time: new Date(currentTime.getTime() - 1 * 24 * 60 * 60 * 1000), // 1天前
    location: `${origin.city}转运中心`,
    description: '快件已到达转运中心，正在分拣',
    status: '运输中'
  });

  // 运输途中
  traces.push({
    time: new Date(currentTime.getTime() - 12 * 60 * 60 * 1000), // 12小时前
    location: '运输途中',
    description: '快件正在运输中，请耐心等待',
    status: '运输中'
  });

  // 到达目的地
  traces.push({
    time: new Date(currentTime.getTime() - 6 * 60 * 60 * 1000), // 6小时前
    location: `${destination.city}转运中心`,
    description: '快件已到达目的地转运中心',
    status: '派送中'
  });

  // 派送中
  traces.push({
    time: new Date(currentTime.getTime() - 2 * 60 * 60 * 1000), // 2小时前
    location: `${destination.city}${destination.district}`,
    description: '快递员正在派送，请保持电话畅通',
    status: '派送中'
  });

  return traces;
}

module.exports = { generateLogisticsTraces };
