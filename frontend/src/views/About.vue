<script setup lang="ts">
</script>

<template>
  <div class="page-shell about-page">
    <section class="hero-grid">
      <article class="panel hero-card">
        <span>OUR IDENTITY</span>
        <h2>重构标准，定义卓越<br />RegCode 品牌愿景</h2>
        <p>我们致力于构建一种兼具专业感与秩序感的数字空间。作为“数智策展人”，我们打破平庸的模板感，为开发者与企业提供具有专业呼吸感的数字化底座。</p>
      </article>
      <article class="panel statement-card">
        <h3>工业精度架构</h3>
        <p>基于 Element Plus 深度定制，严控 4px 黄金圆角与无边界设计准则，确保每一像素的交互都精准无误。</p>
        <div class="statement-card__foot">已为 2000+ 企业提供服务</div>
      </article>
    </section>

    <section class="feature-grid">
      <article class="panel feature-card">
        <h3>数智策展</h3>
        <p>通过意图明确的非对称布局，将数据转化为具有社论感的专业界面呈现。</p>
      </article>
      <article class="panel feature-card">
        <h3>工业级稳定</h3>
        <p>毫秒级链路追踪与全方位的容灾体系，为业务核心提供长期护航。</p>
      </article>
      <article class="panel feature-card">
        <h3>安全合规</h3>
        <p>符合全球数据安全标准，采用动态加密与最小权限设计守护资产流转。</p>
      </article>
    </section>

    <section class="panel contact-card">
      <div>
        <h3>联系我们</h3>
        <ul>
          <li><strong>工作时间</strong><span>周一至周五 09:00 - 18:00 (GMT+8)</span></li>
          <li><strong>电子邮箱</strong><span>support@regcode-admin.com</span></li>
          <li><strong>总部地址</strong><span>上海市浦东新区张江高科技园区数智路 888 号</span></li>
        </ul>
      </div>
      <div class="qr-card">
        <div class="qr-card__box">客服</div>
        <span>扫码添加企业客服企微</span>
      </div>
    </section>
  </div>
</template>

<style scoped lang="scss">
.about-page {
  display: grid;
  gap: 16px;
}

.hero-grid,
.feature-grid {
  display: grid;
  gap: 16px;
}

.hero-grid {
  grid-template-columns: 1.35fr 0.65fr;
}

.feature-grid {
  grid-template-columns: repeat(3, 1fr);
}

.hero-card,
.statement-card,
.feature-card,
.contact-card {
  padding: 20px;
}

.hero-card {
  min-height: 240px;
  color: #fff;
  background: linear-gradient(135deg, #409eff, #66b1ff);

  span {
    color: rgba(255, 255, 255, 0.72);
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.08em;
  }

  h2 {
    margin: 14px 0 0;
    font-size: 34px;
    line-height: 1.2;
    letter-spacing: -0.03em;
    font-weight: 600;
  }

  p {
    max-width: 620px;
    margin: 16px 0 0;
    line-height: 1.9;
    color: rgba(255, 255, 255, 0.82);
  }
}

.statement-card {
  display: flex;
  flex-direction: column;
  justify-content: space-between;

  h3 {
    margin: 0;
    font-size: 24px;
    font-weight: 600;
  }

  p {
    margin-top: 14px;
    color: var(--rc-text-soft);
    line-height: 1.8;
  }

  &__foot {
    margin-top: auto;
    color: var(--rc-text-soft);
    font-weight: 500;
  }
}

.feature-card {
  background: #fafafa;

  h3 {
    margin: 0 0 12px;
    font-size: 16px;
    font-weight: 600;
  }

  p {
    margin: 0;
    color: var(--rc-text-soft);
    line-height: 1.8;
  }
}

.contact-card {
  display: grid;
  grid-template-columns: 1.2fr 0.8fr;
  gap: 16px;

  h3 {
    margin: 0 0 18px;
    font-size: 24px;
    font-weight: 600;
  }

  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 16px;
  }

  li {
    display: grid;
    gap: 6px;
  }

  span {
    color: var(--rc-text-soft);
  }
}

.qr-card {
  display: grid;
  place-items: center;
  gap: 12px;
  text-align: center;
  background: #fafafa;
  border: 1px solid var(--rc-border);
  border-radius: 4px;

  &__box {
    width: 160px;
    aspect-ratio: 1;
    border-radius: 8px;
    background: linear-gradient(135deg, #409eff, #66b1ff);
    color: #fff;
    display: grid;
    place-items: center;
    font-size: 28px;
    font-weight: 700;
  }

  span {
    color: var(--rc-primary);
    font-weight: 500;
  }
}

@media (max-width: 1080px) {
  .hero-grid,
  .feature-grid,
  .contact-card {
    grid-template-columns: 1fr;
  }
}
</style>
