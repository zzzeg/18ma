export const dashboardMetrics = [
  { label: '总收益 (CNY)', value: 1284592, trend: '+12.4% 较上月', accent: 'blue' },
  { label: '待结算金额', value: 42105.5, trend: '预计 3 个工作日内到账', accent: 'green' },
  { label: '昨日收益', value: 12480.5, trend: '结算周期：2023-10-26', accent: 'emerald' },
]

export const channelDistribution = [
  { label: 'API 接口', value: 45, color: '#0e67af' },
  { label: '云端订阅', value: 30, color: '#4f9df1' },
  { label: '技术支持', value: 25, color: '#67c23a' },
]

export const recentTradeRows = [
  { id: '#RC-981240', name: '企业级数据加密 API', buyer: 'TechCorp Ltd.', time: '2023-10-24 14:32', amount: 8400, status: '已支付' },
  { id: '#RC-981239', name: '高性能推理模型 V2', buyer: '张晓明', time: '2023-10-24 12:15', amount: 1299, status: '已支付' },
  { id: '#RC-981238', name: '地理围栏服务（月付）', buyer: 'Global Logis', time: '2023-10-24 09:44', amount: 450, status: '待处理' },
  { id: '#RC-981237', name: '分布式存储资源包', buyer: '创新实验室', time: '2023-10-23 21:05', amount: 12000, status: '已支付' },
]

export const resourceMetrics = [
  { label: '总资源数量', value: 1284, hint: '+12%' },
  { label: '活跃资源', value: 1102, hint: '正常运行' },
  { label: '异常资源', value: 14, hint: '需处理' },
  { label: '累计收益', value: 42850, hint: '总额' },
]

export const resourceRows = [
  { id: 'RES-88291', name: '企业级 API 授权核心', typeValue: '文件', price: 299, earnings: 12450, status: '已启用', color: '#0e67af' },
  { id: 'RES-88302', name: '高并发中间件集群', typeValue: '网盘', price: 899, earnings: 5394, status: '已停用', color: '#e6a23c' },
  { id: 'RES-88315', name: '分布式存储节点 B3', typeValue: '链接', price: 45, earnings: 2115, status: '已启用', color: '#4f9df1' },
  { id: 'RES-88344', name: '智能报表生成模块', typeValue: '文本', price: 150, earnings: 0, status: '待发布', color: '#cbd5e1' },
]

export const paymentHistoryRows = [
  { time: '2023-11-24 14:32:01', resourceId: 'RES-88921-A', name: 'GPT-4 Turbo API 调用', type: 'API 接口', amount: 1240, status: '支付成功' },
  { time: '2023-11-24 12:15:45', resourceId: 'RES-90112-C', name: '企业云存储 (500GB)', type: '存储资源', amount: 450, status: '待确认' },
  { time: '2023-11-23 18:05:22', resourceId: 'RES-77234-F', name: 'CDN 流量加速包 (1TB)', type: '网络带宽', amount: 88, status: '支付失败' },
  { time: '2023-11-23 09:44:10', resourceId: 'RES-11200-X', name: 'GPU 计算集群 (H100)', type: '计算算力', amount: 12800, status: '支付成功' },
  { time: '2023-11-22 15:20:00', resourceId: 'RES-33451-B', name: '数据库分片集群 4C8G', type: '存储资源', amount: 1599, status: '支付成功' },
]

export const balanceRows = [
  { time: '2023-10-27 14:30:21', id: 'TX-20231027-00412', type: '平台分销结算', amount: 2450, status: '交易成功' },
  { time: '2023-10-27 12:15:05', id: 'TX-20231027-00398', type: '提现扣除', amount: -15000, status: '处理中' },
  { time: '2023-10-27 09:02:44', id: 'TX-20231027-00355', type: '广告位返现', amount: 85.2, status: '交易成功' },
  { time: '2023-10-26 18:44:12', id: 'TX-20231026-11822', type: '资源销售提成', amount: 3120, status: '交易成功' },
  { time: '2023-10-26 10:10:00', id: 'TX-20231026-11750', type: '平台手续费', amount: -12.5, status: '交易成功' },
]

export const withdrawalRows = [
  { id: 'TX20231105012', time: '2023-11-05 14:20:11', amount: 2000, account: '招商银行 (尾号 4592)', status: '已到账' },
  { id: 'TX20231107044', time: '2023-11-07 09:15:33', amount: 5400, account: '支付宝 (reg***@gmail.com)', status: '审核中' },
  { id: 'TX20231028091', time: '2023-10-28 18:45:02', amount: 1200, account: '工商银行 (尾号 0012)', status: '已驳回' },
  { id: 'TX20231020112', time: '2023-10-20 11:30:25', amount: 8000, account: '建设银行 (尾号 7741)', status: '已到账' },
  { id: 'TX20231015003', time: '2023-10-15 16:55:10', amount: 3500, account: '支付宝 (reg***@gmail.com)', status: '已到账' },
]

export const paymentChannels = [
  { name: 'AliPay_H5_Global_01', type: '支付宝 H5 直付', ratio: 80, status: '运行中', id: 'CN_AL0921' },
  { name: 'WeChat_Native_04', type: '微信小程序支付', ratio: 45, status: '运行中', id: 'CN_WX8823' },
  { name: 'UnionPay_QuickPass_9', type: '银联云闪付', ratio: 10, status: '维护中', id: 'CN_UP4410' },
  { name: 'FastPay_Gate_X2', type: '第三方快捷支付', ratio: 25, status: '已停用', id: 'CN_FP0012' },
]

export const rechargeRows = [
  { time: '2023-11-24 09:15:22', id: 'RC2023112400192', amount: 5000, method: '银行卡转账', status: '成功' },
  { time: '2023-11-23 18:42:05', id: 'RC2023112300841', amount: 2000, method: '支付宝', status: '处理中' },
  { time: '2023-11-22 11:20:44', id: 'RC2023112200332', amount: 10000, method: '微信支付', status: '成功' },
  { time: '2023-11-20 14:30:11', id: 'RC2023112000551', amount: 1500, method: '余额转充', status: '成功' },
]

export const messageThreads = [
  { id: 1, title: '用户 #8921 (李勇)', preview: '你好，关于昨天订单资源无法使用的问题...', time: '14:20', online: true },
  { id: 2, title: '系统安全告警', preview: '检测到新的账号在新 IP 地址登录，请核实...', time: '10:05', online: false },
  { id: 3, title: '开发者团队', preview: '2.4.0 版本更新日志现已发布，点击查看详情', time: '昨天', online: false },
  { id: 4, title: '用户 #7732 (王芳)', preview: '感谢回复，问题已解决了，服务非常到位。', time: '昨天', online: false },
]

export const messageConversation = [
  { id: 1, role: 'user', time: '14:18', text: '你好，我刚才购买的专业版激活码在输入后提示无效，你们可以帮我确认一下为什么吗？' },
  { id: 2, role: 'admin', time: '14:20', text: '你好，李先生。我帮你检查带来不便。请问你使用的是哪一个版本的客户端？另外请检查激活码前后的空格是否已删除。' },
  { id: 3, role: 'user', time: '14:23', text: '这是我输入时的截图：' },
]

export const hotResources = [
  { title: '分布式系统监控仪表盘组件库', desc: '支持 React/Vue，开箱即用的工业级图表配置系统。', price: '¥299.00', author: 'TechCreator', tag: '代码' },
  { title: '云原生架构白皮书 (2024版)', desc: '深度剖析 K8s、Service Mesh 在万亿流量下的落地实践。', price: '免费', author: 'ArchitectureLab', tag: '文档' },
  { title: '电商大促全链路压测套件', desc: '基于 Go 编写的高并发流量仿真引擎，支持分布式部署。', price: '¥1,200.00', author: 'SRE_Master', tag: '套件' },
  { title: '中后台 UI 原型设计组件库', desc: '100+ 微页面模版，基于最新的 Element Plus 规范。', price: '¥159.00', author: 'DesignSystem', tag: '模板' },
]

export const homeSales = [40, 78, 52, 92, 80, 105, 68]
