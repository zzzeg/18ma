<template>
  <div class="protocol-page">
    <section class="panel protocol-card">
      <h1>服务协议</h1>
      <p>本页面用于展示平台的基础服务协议、资源交易约束与隐私说明。当前前端已预留该模块，后续可按业务法务内容补充正式条款。</p>
      <ol>
        <li>资源交易需遵守国家法律法规及平台内容发布规范。</li>
        <li>用户应保证上传资源拥有合法授权，不得侵权。</li>
        <li>卡密兑换成功后，平台将按照资源设定开放对应访问权限。</li>
      </ol>
    </section>
  </div>
</template>

<style scoped lang="scss">
.protocol-page {
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 24px;
}

.protocol-card {
  width: min(880px, 100%);
  padding: 32px;

  h1 {
    margin: 0 0 18px;
    font-size: 2rem;
  }

  p,
  li {
    color: var(--rc-text-soft);
    line-height: 1.9;
  }
}
</style>
