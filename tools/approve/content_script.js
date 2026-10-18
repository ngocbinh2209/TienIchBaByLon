const FB_GROUP_AUTO_MOD_VERSION = '1.42.77';
if (window.fbGroupAutoModVersion === FB_GROUP_AUTO_MOD_VERSION) {
  console.log('FB Group Auto Mod already injected:', FB_GROUP_AUTO_MOD_VERSION);
} else {
  window.fbGroupAutoModInjected = true;
  window.fbGroupAutoModVersion = FB_GROUP_AUTO_MOD_VERSION;

  const RULES = {
    // Quy tắc chính cho nhóm tuyển dụng / tìm việc Đà Nẵng.
    // 1.42.20: Auto không quét/phân loại lại; chỉ bấm Phê duyệt/Từ chối theo đúng snapshot đã Scan và xác minh Facebook đã áp dụng thao tác.
    findJobTriggers: [
      'tìm việc', 'tim viec', 'tìm việc làm', 'tim viec lam', 'xin việc', 'xin viec',
      '[tìm việc]', '[tim viec]', '[ứng viên]', '[ung vien]', 'ứng viên', 'ung vien',
      'mong muốn tìm', 'mong muon tim', 'cần việc', 'can viec', 'cần tìm việc', 'can tim viec',
      'đang tìm việc', 'dang tim viec', 'tìm công việc', 'tim cong viec', 'tìm job', 'tim job',
      'muốn tìm việc', 'muon tim viec', 'em cần việc', 'em can viec', 'mình cần việc', 'minh can viec',
      'mình tìm việc', 'minh tim viec', 'tôi tìm việc', 'toi tim viec', 'ứng tuyển', 'ung tuyen'
    ],
    recruitmentTriggers: [
      'tuyển dụng', 'tuyen dung', 'cần tuyển', 'can tuyen', 'tuyển nhân viên', 'tuyen nhan vien',
      'tuyển nv', 'tuyen nv', 'tuyển gấp', 'tuyen gap', 'tuyển nam', 'tuyen nam', 'tuyển nữ', 'tuyen nu',
      'cần người', 'can nguoi', 'nhân viên', 'nhan vien', 'phục vụ', 'phuc vu', 'tạp vụ', 'tap vu',
      'casual', 'phụ bếp', 'phu bep', 'bếp', 'bep', 'thu ngân', 'thu ngan', 'bảo vệ', 'bao ve',
      'shipper', 'giao hàng', 'giao hang', 'bán hàng', 'ban hang', 'pha chế', 'pha che', 'barista',
      'lễ tân', 'le tan', 'kế toán', 'ke toan', 'telesale', 'sales', 'part time', 'part-time',
      'full time', 'full-time', 'thời vụ', 'thoi vu', 'việc làm', 'viec lam', 'đi làm', 'di lam',
      'ca làm', 'ca lam', 'lương', 'luong'
    ],
    spamTriggers: [
      // Đúng các từ khóa người dùng yêu cầu chặn.
      'chốt đơn', 'chot don', 'nhận hoa hồng', 'nhan hoa hong', 'việc nhẹ lương cao', 'viec nhe luong cao',
      'mẹ bỉm', 'me bim', 'cho vay',
      // Một số biến thể rõ ràng cùng nhóm rác/nguy cơ.
      'vay nhanh', 'vay tiền', 'vay tien', 'giải ngân', 'giai ngan', 'nợ xấu', 'no xau',
      'đa cấp', 'da cap', 'casino', 'cá cược', 'ca cuoc', 'tài xỉu', 'tai xiu', 'scam', 'lừa đảo', 'lua dao'
    ],
    loanScamTriggers: [
      'cho vay', 'vay tiền', 'vay tien', 'vay nhanh', 'vay vốn', 'vay von', 'giải ngân', 'giai ngan',
      'nợ xấu', 'no xau', 'đáo hạn', 'dao han', 'hỗ trợ vay', 'ho tro vay', 'app vay', 'tín dụng đen', 'tin dung den',
      'phí hồ sơ', 'phi ho so', 'phí nhận việc', 'phi nhan viec', 'đóng phí', 'dong phi', 'nạp tiền', 'nap tien',
      'chuyển khoản trước', 'chuyen khoan truoc', 'đặt cọc trước', 'dat coc truoc', 'cọc giữ chỗ', 'coc giu cho'
    ],
    policyRiskTriggers: [
      'casino', 'cá cược', 'ca cuoc', 'tài xỉu', 'tai xiu', 'đánh bạc', 'danh bac', 'kèo bóng', 'keo bong',
      'đa cấp', 'da cap', 'tiền ảo', 'tien ao', 'crypto', 'mua bán tài khoản', 'mua ban tai khoan',
      'hack', 'tool hack', 'hàng cấm', 'hang cam', 'ma túy', 'ma tuy'
    ],
    commerceStrongTriggers: [
      'chốt đơn', 'chot don', 'đặt hàng', 'dat hang', 'mua ngay', 'sỉ lẻ', 'si le', 'ship toàn quốc', 'ship toan quoc',
      'khuyến mãi', 'khuyen mai', 'sale off', 'giảm giá', 'giam gia', 'mở bán', 'mo ban', 'cần bán', 'can ban',
      'thanh lý', 'thanh ly', 'order hàng', 'order hang', 'shop online', 'mua bán', 'mua ban', 'giá chỉ', 'gia chi',
      'sản phẩm', 'san pham', 'combo', 'inbox đặt hàng', 'inbox dat hang'
    ],
    suspiciousRecruitmentTriggers: [
      'việc nhẹ lương cao', 'viec nhe luong cao', 'thu nhập không giới hạn', 'thu nhap khong gioi han',
      'không cần kinh nghiệm thu nhập cao', 'khong can kinh nghiem thu nhap cao', 'nhận hoa hồng', 'nhan hoa hong',
      'mẹ bỉm', 'me bim', 'kiếm tiền online', 'kiem tien online', 'làm online tại nhà', 'lam online tai nha',
      'chỉ cần điện thoại', 'chi can dien thoai', 'không cần phỏng vấn', 'khong can phong van'
    ],
    daNangTriggers: [
      'đà nẵng', 'da nang', 'hải châu', 'hai chau', 'thanh khê', 'thanh khe', 'sơn trà', 'son tra',
      'ngũ hành sơn', 'ngu hanh son', 'cẩm lệ', 'cam le', 'liên chiểu', 'lien chieu', 'hòa vang', 'hoa vang'
    ],
    otherCityTriggers: [
      'hà nội', 'ha noi', 'hồ chí minh', 'ho chi minh', 'tp hcm', 'tphcm', 'sài gòn', 'sai gon',
      'bình dương', 'binh duong', 'đồng nai', 'dong nai', 'hải phòng', 'hai phong', 'cần thơ', 'can tho',
      'huế', 'hue', 'quảng nam', 'quang nam', 'nghệ an', 'nghe an', 'thanh hóa', 'thanh hoa'
    ]
  };

  const isSpamSection = window.location.pathname.includes('/spam');
  const isPendingSection = window.location.pathname.includes('/pending_posts');

  let taskGeneration = 0;

  function beginTask() {
    taskGeneration += 1;
    return taskGeneration;
  }

  function cancelCurrentTask() {
    taskGeneration += 1;
  }

  function taskIsCurrent(token) {
    return token === taskGeneration;
  }

  function normalizeText(text) {
    if (!text) return '';
    return text
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
  }

  function containsAny(text, keywords) {
    return keywords.some((keyword) => text.includes(normalizeText(keyword)));
  }


  function getCurrentGroupId() {
    const match = location.pathname.match(/\/groups\/([^/]+)/i);
    return match?.[1] || 'unknown-group';
  }

  const ROLLING_24H_MS = 24 * 60 * 60 * 1000;

  function approvalHistoryStorageKey() {
    return `fbApproveRolling24h:${getCurrentGroupId()}`;
  }

  async function loadApprovedAuthorsWithin24h() {
    try {
      const key = approvalHistoryStorageKey();
      const data = await chrome.storage.local.get(key);
      const raw = Array.isArray(data?.[key]) ? data[key] : [];
      const now = Date.now();
      const fresh = raw.filter((item) => item?.authorKey && Number.isFinite(Number(item.activityAt)) && now - Number(item.activityAt) < ROLLING_24H_MS);
      if (fresh.length !== raw.length) await chrome.storage.local.set({ [key]: fresh });
      const map = new Map();
      for (const item of fresh) {
        const old = map.get(item.authorKey);
        if (!old || Number(item.activityAt) > Number(old.activityAt)) map.set(item.authorKey, item);
      }
      return map;
    } catch (_) {
      return new Map();
    }
  }

  async function saveApprovedAuthorWithin24h(authorKey, post = null) {
    if (!authorKey) return;
    try {
      const key = approvalHistoryStorageKey();
      const data = await chrome.storage.local.get(key);
      const raw = Array.isArray(data?.[key]) ? data[key] : [];
      const now = Date.now();
      const postAge = Number(post?.postAgeMinutes);
      const activityAt = Number.isFinite(postAge) && postAge >= 0
        ? now - Math.min(postAge, 60 * 24 * 30) * 60 * 1000
        : now;
      const fresh = raw.filter((item) => item?.authorKey && Number.isFinite(Number(item.activityAt)) && now - Number(item.activityAt) < ROLLING_24H_MS && item.authorKey !== authorKey);
      fresh.push({ authorKey, activityAt, approvedAt: now, postKey: post ? getStablePostKey(post) : '' });
      await chrome.storage.local.set({ [key]: fresh });
    } catch (_) {}
  }

  function extractPostAgeMinutes(rawText) {
    const t = normalizeText(rawText || '');
    if (/\b(vua xong|just now)\b/.test(t)) return 0;
    if (/\b(hom qua|yesterday)\b/.test(t)) return 24 * 60;
    const minute = t.match(/\b(\d{1,3})\s*(phut|minute|minutes)\b/);
    if (minute) return Number(minute[1]);
    const hour = t.match(/\b(\d{1,2})\s*(gio|hour|hours)\b/);
    if (hour) return Number(hour[1]) * 60;
    const day = t.match(/\b(\d{1,3})\s*(ngay|day|days)\b/);
    if (day) return Number(day[1]) * 24 * 60;
    return null;
  }

  function extractPostAgeMinutesFromContainer(container, rawText = '') {
    const now = Date.now();
    const parseAbsolute = (value) => {
      const n = Number(value);
      if (Number.isFinite(n) && n > 1e9) {
        const ms = n < 1e12 ? n * 1000 : n;
        const minutes = Math.max(0, Math.round((now - ms) / 60000));
        if (minutes < 60 * 24 * 365 * 10) return minutes;
      }
      const parsed = Date.parse(value || '');
      if (Number.isFinite(parsed)) {
        const minutes = Math.max(0, Math.round((now - parsed) / 60000));
        if (minutes < 60 * 24 * 365 * 10) return minutes;
      }
      return null;
    };

    for (const el of Array.from(container?.querySelectorAll?.('time[datetime], [data-utime]') || [])) {
      const value = el.getAttribute('datetime') || el.getAttribute('data-utime') || '';
      const minutes = parseAbsolute(value);
      if (minutes != null) return minutes;
    }

    const relativePattern = /^(vừa xong|just now|hôm qua|yesterday|\d{1,3}\s*(?:phút|phut|minute|minutes|giờ|gio|hour|hours|ngày|ngay|day|days))$/i;
    const candidates = Array.from(container?.querySelectorAll?.('a[href], [role="link"], [aria-label], [title]') || []);
    for (const el of candidates) {
      const href = String(el.href || el.getAttribute?.('href') || '');
      const label = String(el.getAttribute?.('aria-label') || el.getAttribute?.('title') || el.textContent || '').replace(/\s+/g, ' ').trim();
      const isLikelyTimestampLink = /\/posts\/|\/permalink\/|story_fbid|fbid=/.test(href) || el.tagName === 'TIME';
      if (!isLikelyTimestampLink && !relativePattern.test(label)) continue;
      const exact = label.match(relativePattern)?.[0];
      if (exact) {
        const minutes = extractPostAgeMinutes(exact);
        if (minutes != null) return minutes;
      }
    }

    // Fallback chỉ đọc phần đầu card, nơi Facebook đặt tên người đăng + thời gian.
    const head = String(rawText || '').split('\n').slice(0, 5).join(' ');
    return extractPostAgeMinutes(head);
  }

  function extractAccountAgeDays(rawText) {
    const t = normalizeText(rawText || '');
    const patterns = [
      /(?:tai khoan (?:duoc )?tao|account (?:was )?created|tham gia facebook|joined facebook)\s*(?:cach|ago)?\s*(\d+)\s*(ngay|day|days|tuan|week|weeks|thang|month|months)/,
      /(?:tai khoan moi|new account)\s*[:\-]?\s*(\d+)\s*(ngay|day|days|tuan|week|weeks|thang|month|months)/
    ];
    for (const pattern of patterns) {
      const match = t.match(pattern);
      if (!match) continue;
      const n = Number(match[1]);
      const unit = match[2];
      if (!Number.isFinite(n)) continue;
      if (/tuan|week/.test(unit)) return n * 7;
      if (/thang|month/.test(unit)) return n * 30;
      return n;
    }
    return null;
  }

  function getProfilePhotoState(container, authorIdentity) {
    const rawText = normalizeText(container?.innerText || '');
    if (/khong co anh dai dien|no profile photo|default profile picture/.test(rawText)) return true;

    const links = Array.from(container?.querySelectorAll?.('a[href]') || []);
    for (const link of links) {
      const key = profileKeyFromHref(link.href || link.getAttribute('href') || '');
      if (!key || (authorIdentity?.key && key !== authorIdentity.key)) continue;
      const img = link.querySelector('img');
      const svgImage = link.querySelector('image');
      const src = String(img?.src || svgImage?.getAttribute?.('href') || svgImage?.getAttribute?.('xlink:href') || '').toLowerCase();
      if (!src) continue;
      if (/silhouette|default|anonymous|no[_-]?profile|profile[_-]?default/.test(src)) return true;
      return false;
    }
    return null;
  }

  function isWithin24Hours(post) {
    return post?.postAgeMinutes == null || (post.postAgeMinutes >= 0 && post.postAgeMinutes < 24 * 60);
  }

  function getModerationAuthorKey(post) {
    // Ưu tiên ID/profile Facebook thật. Nếu Facebook không để lộ profile URL trong card,
    // vẫn gom theo tên hiển thị trong CHÍNH đợt scan để tránh 1 tác giả được duyệt 2 bài.
    const strong = String(post?.authorKey || '').trim();
    if (strong) return strong;
    const name = normalizeText(post?.author || '').replace(/\s+/g, ' ').trim();
    if (!name || name.length < 2) return '';
    return `name:${name}`;
  }

  function sortAuthorPostsOldestFirst(list) {
    return (list || []).map((post, index) => ({ post, index })).sort((a, b) => {
      const ageA = Number.isFinite(Number(a.post?.postAgeMinutes)) ? Number(a.post.postAgeMinutes) : null;
      const ageB = Number.isFinite(Number(b.post?.postAgeMinutes)) ? Number(b.post.postAgeMinutes) : null;
      // postAgeMinutes càng lớn = bài được đăng sớm hơn.
      if (ageA != null && ageB != null && ageA !== ageB) return ageB - ageA;
      if (ageA != null && ageB == null) return -1;
      if (ageA == null && ageB != null) return 1;
      return b.index - a.index;
    }).map((item) => item.post);
  }

  function normalizeDuplicateVerdictsForAuthor(list, base) {
    // Nếu cùng một tác giả đăng nhiều bài có nội dung giống nhau, phải dùng CÙNG MỘT
    // kết quả kiểm duyệt nội dung. Lấy bài được đăng sớm nhất làm mẫu để tránh trường hợp
    // cùng một nội dung nhưng một card bị đọc thêm chữ UI rồi bị gắn nhầm là quảng cáo.
    const dupGroups = new Map();
    for (const post of sortAuthorPostsOldestFirst(list)) {
      const dupKey = getDuplicateContentKey(post?.text || '', post?.author || '');
      if (!dupKey) continue;
      if (!dupGroups.has(dupKey)) dupGroups.set(dupKey, []);
      dupGroups.get(dupKey).push(post);
    }

    for (const samePosts of dupGroups.values()) {
      if (samePosts.length < 2) continue;
      const firstPost = samePosts[0];
      const firstKey = getStablePostKey(firstPost);
      const canonicalVerdict = base.get(firstKey) || evaluatePost(firstPost);
      for (const post of samePosts) {
        const key = getStablePostKey(post);
        base.set(key, { ...canonicalVerdict });
      }
    }
  }

  async function build24hModerationPlan(posts) {
    const approvedHistory = await loadApprovedAuthorsWithin24h();
    const decisions = new Map();
    const decisionsByPost = new WeakMap();
    const groups = new Map();

    // Ghi quyết định theo CHÍNH object bài viết để 2 bài giống hệt nhau vẫn có thể
    // mang 2 quyết định khác nhau: bài đầu được duyệt, bài sau bị loại vì 1 bài/24h.
    // Map theo postKey vẫn được giữ để tương thích với các đoạn code cũ.
    const setDecision = (post, verdict) => {
      if (!post || !verdict) return;
      decisionsByPost.set(post, verdict);
      decisions.set(getStablePostKey(post), verdict);
    };

    // Chỉ gom các bài nằm trong cửa sổ 24h theo cùng tác giả. Những bài không gom được
    // (không rõ tác giả / ngoài 24h) vẫn được kiểm duyệt nội dung độc lập như trước.
    for (const post of posts || []) {
      // Lệnh ưu tiên cao nhất: bài share/repost từ Group khác bị từ chối ngay,
      // không kiểm tra nội dung, tuổi tài khoản, avatar hay giới hạn 1 bài/24h.
      if (post?.isSharedPost === true || post?.externalGroupRepost === true) {
        setDecision(post, externalGroupShareVerdict());
        continue;
      }

      if (!isWithin24Hours(post)) {
        setDecision(post, evaluatePost(post));
        continue;
      }
      const authorGroupKey = getModerationAuthorKey(post);
      if (!authorGroupKey) {
        setDecision(post, evaluatePost(post));
        continue;
      }
      if (!groups.has(authorGroupKey)) groups.set(authorGroupKey, []);
      groups.get(authorGroupKey).push(post);
    }

    for (const [authorGroupKey, list] of groups) {
      // Nếu tác giả đã có một bài được duyệt trong 24 giờ trước đó thì không giữ thêm bài nào.
      // Lịch sử 24h chỉ dùng khi có profile ID thật; name: chỉ dùng để gom trong lần Scan hiện tại.
      const strongAuthorKey = list.find((post) => String(post?.authorKey || '').trim())?.authorKey || '';
      const prior = strongAuthorKey ? approvedHistory.get(strongAuthorKey) : null;
      if (prior) {
        for (const post of list) {
          setDecision(post, {
            decision: 'REJECT', category: 'AUTHOR_24H_LIMIT', score: 0,
            reason: 'Từ chối: thành viên này đã có 1 bài được duyệt trong vòng 24 giờ. Mỗi thành viên chỉ được giữ tối đa 1 bài/24 giờ.'
          });
        }
        continue;
      }

      // Chỉ có 1 bài trong 24h: kiểm duyệt bài đó bình thường.
      if (list.length <= 1) {
        const only = list[0];
        if (only) setDecision(only, evaluatePost(only));
        continue;
      }

      // QUY TẮC CHÍNH:
      // 1) Xếp các bài của cùng tác giả theo thời gian, bài đăng SỚM NHẤT trong 24h là "bài thứ nhất".
      // 2) CHỈ kiểm duyệt nội dung/rủi ro của bài thứ nhất.
      // 3) Nếu bài thứ nhất KHÔNG đạt -> từ chối bài thứ nhất và TỪ CHỐI TOÀN BỘ các bài còn lại của tác giả.
      // 4) Nếu bài thứ nhất ĐẠT -> duyệt đúng bài thứ nhất, mọi bài sau bị từ chối vì vượt 1 bài/24h.
      // Tuyệt đối không evaluate lại các bài sau, nhờ vậy 2 bài giống hệt nhau không thể có lý do mâu thuẫn.
      const ordered = sortAuthorPostsOldestFirst(list);
      const firstPost = ordered[0];
      const firstVerdict = evaluatePost(firstPost);
      setDecision(firstPost, firstVerdict);

      if (firstVerdict.decision === 'APPROVE') {
        for (let i = 1; i < ordered.length; i += 1) {
          const post = ordered[i];
          setDecision(post, {
            decision: 'REJECT', category: 'DUPLICATE_AUTHOR_24H', score: 0,
            reason: `Từ chối bài dư: ${post.author || 'thành viên'} có ${list.length} bài trong vòng 24 giờ. Bài đầu tiên đã vượt kiểm duyệt nội dung và được chọn để duyệt; các bài sau bị loại vì mỗi thành viên chỉ được giữ tối đa 1 bài/24 giờ.`
          });
        }
      } else {
        for (let i = 1; i < ordered.length; i += 1) {
          const post = ordered[i];
          setDecision(post, {
            decision: 'REJECT', category: 'AUTHOR_FIRST_POST_FAILED', score: 0,
            reason: `Từ chối toàn bộ bài của ${post.author || 'thành viên'} trong đợt này: bài đầu tiên trong vòng 24 giờ không vượt kiểm duyệt nội dung (${firstVerdict.reason || 'nội dung không phù hợp nhóm'}).`
          });
        }
      }
    }

    return { decisions, decisionsByPost, approvedHistory };
  }

  function isSharedFromAnotherGroup(text) {
    const t = normalizeText(text || '');
    // 1.42.5: KHÔNG coi "Chia sẻ bài viết" / "Share post" là repost.
    // Facebook chèn các nhãn hành động/aria-label này vào hầu như mọi card, kể cả bài gốc.
    // Chỉ đánh dấu khi câu có NGUỒN rõ ràng: "đã chia sẻ bài viết của...", "shared ... from...".
    return /(?:da chia se|chia se) (?:mot |1 )?(?:bai viet|post|video|anh) (?:cua|tu)\b|shared (?:a |an )?(?:post|video|photo) from\b|bai viet goc tu (?:nhom|group)\b|nguon tu (?:nhom|group)\b/.test(t);
  }


  function hasExternalGroupPostLink(container) {
    if (!container?.querySelectorAll) return false;
    const currentGroup = String(getCurrentGroupId() || '').toLowerCase();
    const cardRect = container.getBoundingClientRect?.();
    const rawHead = String(container.innerText || '').split('\n').slice(0, 10).join(' ');
    const headText = normalizeText(rawHead);

    for (const link of Array.from(container.querySelectorAll('a[href]'))) {
      const href = link.href || link.getAttribute('href') || '';
      try {
        const url = new URL(href, location.origin);
        const match = url.pathname.match(/^\/groups\/([^/?#]+)/i);
        if (!match) continue;

        const linkedGroup = String(match[1] || '').toLowerCase();
        if (!linkedGroup || !currentGroup || linkedGroup === currentGroup) continue;

        // Link thẳng tới post/permalink của Group khác = bằng chứng chắc chắn là repost/share ngoài Group.
        if (/^\/groups\/[^/?#]+\/(?:posts|permalink)\//i.test(url.pathname)) return true;

        // Facebook thường chỉ để link tên Group trong khung bài được chia sẻ, ví dụ:
        // "Người đăng ▸ Tên Group khác". Bắt cả dạng này để không bỏ sót.
        const nestedArticle = link.closest?.('[role="article"], article');
        if (nestedArticle && nestedArticle !== container && container.contains(nestedArticle)) return true;

        const label = normalizeText(
          link.getAttribute?.('aria-label') || link.getAttribute?.('title') || link.textContent || ''
        );
        const linkRect = link.getBoundingClientRect?.();
        const nearHeader = !!(cardRect && linkRect && Number.isFinite(cardRect.height) && cardRect.height > 0
          && linkRect.top >= cardRect.top - 8
          && linkRect.top <= cardRect.top + Math.min(240, cardRect.height * 0.55));
        const looksLikeShareHeader = label && headText.includes(label)
          && (headText.includes('▸') || headText.includes('›') || /(?:da chia se|chia se|shared)/.test(headText));

        if (nearHeader || looksLikeShareHeader) return true;
      } catch (_) {}
    }
    return false;
  }

  function externalGroupShareVerdict() {
    return {
      decision: 'REJECT',
      category: 'EXTERNAL_GROUP_SHARE',
      score: 0,
      reason: 'Từ chối ngay: bài được chia sẻ từ Group Facebook khác. Bỏ qua kiểm tra nội dung và các thông tin khác.'
    };
  }

  function countMatchedSignals(text, keywords) {
    let count = 0;
    for (const keyword of keywords) {
      if (text.includes(normalizeText(keyword))) count += 1;
    }
    return count;
  }

  function looksLikeJobSalesRole(text) {
    return /(?:tuyen|can tuyen|nhan vien|viec lam|vi tri|ung tuyen).{0,50}(?:ban hang|sales|sale|kinh doanh)|(?:ban hang|sales|sale|kinh doanh).{0,50}(?:tuyen|nhan vien|vi tri|viec lam)/.test(text);
  }

  function getDuplicateContentKey(text, author) {
    const authorText = author ? normalizeText(author) : '';
    let content = normalizeText(text);
    if (authorText) {
      content = content.replaceAll(authorText, ' ');
    }
    return content
      .replace(/\b\d+\s*(phut|gio|ngay|tuan|thang|minute|minutes|hour|hours|day|days)\b/g, ' ')
      .replace(/\b(phe duyet|duyet|tu choi|approve|reject|decline|xem them|see more|dang|post|publish)\b/g, ' ')
      .replace(/[^a-z0-9]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 500);
  }

  function getButtonText(button) {
    return normalizeText(
      button.innerText || button.textContent || button.getAttribute('aria-label') || button.getAttribute('title') || ''
    );
  }

  function findActionButton(container, pattern) {
    // Strategy 1: Find actual <button> elements only
    let buttons = container.querySelectorAll('button');
    console.log(`  🔎 Strategy 1 - Searching in ${buttons.length} <button> elements`);
    
    let found = Array.from(buttons).find(button => {
      const txt = getButtonText(button);
      return pattern.test(txt);
    });
    
    if (found) {
      console.log(`  ✓ Found in <button>: "${getButtonText(found)}"`);
      return found;
    }
    
    // Strategy 2: Try div, span, a elements with proper role or styling
    console.log(`  ❌ No <button> matched, trying div/span/a...`);
    buttons = container.querySelectorAll('div[role="button"], span[role="button"], a[role="button"], div[class*="btn"], span[class*="btn"]');
    console.log(`  Found ${buttons.length} role="button" or btn elements`);
    
    found = Array.from(buttons).find(button => {
      const txt = getButtonText(button);
      return pattern.test(txt);
    });
    
    if (found) {
      console.log(`  ✓ Found in role="button": "${getButtonText(found)}"`);
      return found;
    }
    
    // Strategy 3: Fallback - search all elements in container that contain matching text
    console.log(`  ❌ No role="button" matched, trying all clickable elements...`);
    const allElements = container.querySelectorAll('*');
    found = Array.from(allElements).find(el => {
      const txt = getButtonText(el);
      // Check if text matches AND element looks clickable
      if (pattern.test(txt) && txt.length < 50) {
        const style = window.getComputedStyle(el);
        const isCursor = style.cursor === 'pointer';
        const isClickable = el.onclick || el.hasAttribute('role') || ['BUTTON', 'A'].includes(el.tagName);
        return isCursor || isClickable || el.classList.toString().includes('btn');
      }
      return false;
    });
    
    if (found) {
      console.log(`  ✓ Found clickable element: "${getButtonText(found)}" tag=${found.tagName}`);
      return found;
    }
    
    console.log(`  ❌ No button found for pattern ${pattern}`);
    return undefined;
  }




  function findActionButtons(pattern) {
    // Find all clickable elements that match pattern
    let buttons = document.querySelectorAll('button, div[role="button"], span[role="button"], a[role="button"], div[class*="btn"], span[class*="btn"]');
    console.log(`🔍 findActionButtons: Searching in ${buttons.length} buttons for pattern ${pattern}`);
    const found = Array.from(buttons).filter((button) => {
      const txt = getButtonText(button);
      return pattern.test(txt);
    });
    console.log(`Found ${found.length} matching buttons`);
    return found;
  }

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function getExpectedPendingCount() {
    if (!isPendingSection) return 0;

    const bodyText = document.body?.innerText || '';
    const patterns = [
      /bài\s*viết\s*đang\s*chờ\s*[·•:\-]?\s*(\d+)/i,
      /bai\s*viet\s*dang\s*cho\s*[·•:\-]?\s*(\d+)/i,
      /(\d+)\s*mục\s*mới\s*hôm\s*nay/i,
      /(\d+)\s*muc\s*moi\s*hom\s*nay/i,
    ];

    for (const pattern of patterns) {
      const match = bodyText.match(pattern);
      const count = Number(match?.[1] || 0);
      if (Number.isFinite(count) && count > 0) return count;
    }
    return 0;
  }

  function getPostPermalink(container) {
    if (!container?.querySelectorAll) return '';
    const links = Array.from(container.querySelectorAll('a[href]'));
    for (const link of links) {
      const href = link.href || link.getAttribute('href') || '';
      if (!href) continue;
      if (
        /facebook\.com\/(?:groups\/[^/]+\/)?(?:posts|permalink)\//i.test(href)
        || /facebook\.com\/photo\//i.test(href)
        || /[?&](?:story_fbid|fbid|post_id|pending_post_id|multi_permalinks)=/i.test(href)
        || /\/groups\/[^/]+\/(?:posts|permalink)\//i.test(href)
      ) {
        return href.split('#')[0];
      }
    }
    return '';
  }

  function getDomIdentityHints(container) {
    if (!container) return '';
    const hints = [];
    const attrs = ['id', 'data-pagelet', 'data-ft', 'data-testid', 'aria-labelledby', 'aria-describedby'];
    for (const name of attrs) {
      const value = container.getAttribute?.(name);
      if (value && String(value).length < 500) hints.push(`${name}:${value}`);
    }
    return hints.join('|').slice(0, 900);
  }

  function getStrongPostIdentity(container, permalink = '') {
    const values = [];
    if (permalink) values.push(permalink);

    const attrs = ['id', 'data-ft', 'data-store', 'data-testid', 'data-pagelet', 'aria-describedby', 'aria-labelledby'];
    let node = container;
    for (let depth = 0; node && depth < 4; depth += 1, node = node.parentElement) {
      for (const name of attrs) {
        const value = node.getAttribute?.(name);
        if (value) values.push(String(value));
      }
    }

    for (const link of Array.from(container?.querySelectorAll?.('a[href]') || [])) {
      const href = String(link.href || link.getAttribute('href') || '');
      if (href) values.push(href);
    }

    const joined = values.join(' | ');
    const patterns = [
      /(?:story_fbid|pending_post_id|top_level_post_id|post_id|mf_story_key|ft_ent_identifier|fbid)["'=:\/?&%\\-]{0,12}(\d{5,})/i,
      /\/(?:posts|permalink)\/(\d{5,})/i,
      /[?&](?:story_fbid|fbid|post_id|pending_post_id|multi_permalinks)=([A-Za-z0-9._:-]+)/i,
    ];
    for (const pattern of patterns) {
      const match = joined.match(pattern);
      if (match?.[1]) return `fb:${match[1]}`;
    }
    return '';
  }

  function getMediaIdentityHints(container) {
    if (!container?.querySelectorAll) return '';
    const hints = [];
    for (const media of Array.from(container.querySelectorAll('img[src],video[src],video[poster],a[href]'))) {
      let value = '';
      if (media.tagName === 'IMG') value = media.currentSrc || media.src || '';
      else if (media.tagName === 'VIDEO') value = media.currentSrc || media.src || media.poster || '';
      else value = media.href || media.getAttribute('href') || '';
      if (!value) continue;
      const id = value.match(/(?:fbid|story_fbid|post_id)=([^&#]+)/i)?.[1]
        || value.match(/\/(?:posts|permalink)\/([^/?#]+)/i)?.[1]
        || value.match(/\/([0-9]{8,})_(?:[0-9]{8,})_/i)?.[1];
      if (id) hints.push(id);
    }
    return [...new Set(hints)].slice(0, 5).join('|');
  }

  function cleanPostBodyForFingerprint(post) {
    let content = normalizeText(post?.text || '');
    const author = normalizeText(post?.author || '');
    if (author) content = content.replaceAll(author, ' ');
    content = content
      .replace(/\b\d+\s*(phut|gio|ngay|tuan|thang|minute|minutes|hour|hours|day|days|week|weeks|month|months)\b/g, ' ')
      .replace(/\b(phe duyet|duyet|tu choi|approve|reject|decline|xem them|see more|dang|post|publish|chia se|share|thich|like|binh luan|comment)\b/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    return content.slice(0, 1400);
  }

  function getPostSemanticFingerprint(post) {
    const strong = post.strongIdentity || getStrongPostIdentity(post.element, post.permalink || '');
    if (strong) return strong;
    const author = post.authorKey || normalizeText(post.author || '');
    const media = post.mediaIdentity || getMediaIdentityHints(post.element);
    const body = cleanPostBodyForFingerprint(post);
    return `sem:${author}|${media}|${body}`;
  }

  function getStablePostKey(post) {
    return getPostSemanticFingerprint(post);
  }

  function sameScanPost(a, b) {
    if (!a || !b) return false;
    if (a.strongIdentity && b.strongIdentity) return a.strongIdentity === b.strongIdentity;
    return getPostSemanticFingerprint(a) === getPostSemanticFingerprint(b);
  }

  function getPageY(element) {
    try {
      const rect = element.getBoundingClientRect();
      return rect.top + (window.scrollY || document.documentElement.scrollTop || 0);
    } catch (_) {
      return 0;
    }
  }

  function findSequenceOverlap(existing, visible) {
    const max = Math.min(existing.length, visible.length, 14);
    for (let size = max; size >= 1; size -= 1) {
      let ok = true;
      for (let i = 0; i < size; i += 1) {
        if (!sameScanPost(existing[existing.length - size + i], visible[i])) {
          ok = false;
          break;
        }
      }
      if (ok) return size;
    }

    // Facebook đôi khi thêm/bớt một card ở mép viewport. Tìm anchor gần cuối chuỗi đã thu thập.
    const start = Math.max(0, existing.length - 18);
    let best = null;
    for (let ei = start; ei < existing.length; ei += 1) {
      for (let vi = 0; vi < visible.length; vi += 1) {
        if (!sameScanPost(existing[ei], visible[vi])) continue;
        let run = 0;
        while (ei + run < existing.length && vi + run < visible.length
          && sameScanPost(existing[ei + run], visible[vi + run])) run += 1;
        if (!best || run > best.run || (run === best.run && ei > best.ei)) best = { ei, vi, run };
      }
    }
    if (best && best.run > 0) return { appendFrom: best.vi + best.run, anchor: true };
    return 0;
  }

  function mergeVisiblePostsOrdered(sequence) {
    const visible = collectPostNodes().sort((a, b) => getPageY(a.element) - getPageY(b.element));
    if (!visible.length) return { visibleCount: 0, added: 0, visible: [] };

    if (!sequence.length) {
      sequence.push(...visible);
      return { visibleCount: visible.length, added: visible.length, visible };
    }

    const overlap = findSequenceOverlap(sequence, visible);
    let appendFrom = 0;
    if (typeof overlap === 'number') appendFrom = overlap;
    else appendFrom = overlap.appendFrom || 0;

    // Nếu không tìm được overlap, thử định vị từng card bằng strong ID/fingerprint trong phần cuối.
    if (!appendFrom && overlap === 0) {
      let lastMatchedVisible = -1;
      let lastMatchedExisting = -1;
      const tailStart = Math.max(0, sequence.length - 24);
      for (let vi = 0; vi < visible.length; vi += 1) {
        for (let ei = sequence.length - 1; ei >= tailStart; ei -= 1) {
          if (!sameScanPost(sequence[ei], visible[vi])) continue;
          if (ei >= lastMatchedExisting) {
            lastMatchedExisting = ei;
            lastMatchedVisible = vi;
          }
          break;
        }
      }
      if (lastMatchedVisible >= 0) appendFrom = lastMatchedVisible + 1;
    }

    let added = 0;
    for (let i = appendFrom; i < visible.length; i += 1) {
      const post = visible[i];
      // Strong ID đã có ở bất kỳ đâu chắc chắn là cùng một bài; không thêm lại.
      if (post.strongIdentity && sequence.some((old) => old.strongIdentity === post.strongIdentity)) continue;
      // Card không có strong ID vẫn được giữ theo vị trí trong chuỗi. Nếu người dùng thật sự
      // đăng 2 bài giống hệt nhau, đó vẫn là 2 bài riêng và phải được đếm đủ. Overlap của viewport
      // đã chịu trách nhiệm loại phần card lặp khi cuộn.
      sequence.push(post);
      added += 1;
    }
    return { visibleCount: visible.length, added, visible };
  }

  function recordVisibleMultiplicity(maxMultiplicity, visible) {
    const counts = new Map();
    for (const post of visible || []) {
      if (post.strongIdentity) continue;
      const fp = getPostSemanticFingerprint(post);
      counts.set(fp, (counts.get(fp) || 0) + 1);
    }
    for (const [fp, count] of counts) {
      maxMultiplicity.set(fp, Math.max(maxMultiplicity.get(fp) || 0, count));
    }
  }

  function reconcileSequence(sequence, expectedCount = 0, maxMultiplicity = null) {
    if (!sequence.length) return [];
    const out = [];
    const strongSeen = new Set();
    const semanticSeen = new Map();
    for (const post of sequence) {
      if (post.strongIdentity) {
        if (strongSeen.has(post.strongIdentity)) continue;
        strongSeen.add(post.strongIdentity);
        out.push(post);
        continue;
      }

      const fp = getPostSemanticFingerprint(post);
      const used = semanticSeen.get(fp) || 0;
      // Nếu cùng fingerprint từng xuất hiện đồng thời 2 lần trong viewport thì đó có thể là
      // 2 bài thật giống nhau. Chỉ loại số lần vượt quá mức Facebook từng render đồng thời.
      const allowed = Math.max(1, Number(maxMultiplicity?.get?.(fp) || 1));
      if (used >= allowed) continue;
      semanticSeen.set(fp, used + 1);
      out.push(post);
    }
    // Không cắt cưỡng bức theo expectedCount: thiếu thì tiếp tục quét, thừa thì báo để không giấu lỗi.
    return out;
  }

  function reportScanProgress(found, expected, phase = 'Đang tải thêm bài...') {
    try {
      chrome.runtime.sendMessage({
        action: 'approveScanProgress',
        found,
        expected,
        phase,
      });
    } catch (_) {}
  }

  async function waitForFacebookRender(previousHeight, previousCount, sequence, maxWait = 900, taskToken = null) {
    const scrollElement = document.scrollingElement || document.documentElement || document.body;
    return new Promise((resolve) => {
      let settled = false;
      const finish = (value) => {
        if (settled) return;
        settled = true;
        try { observer.disconnect(); } catch (_) {}
        clearInterval(pollTimer);
        clearTimeout(deadlineTimer);
        resolve(value);
      };

      const check = () => {
        if (taskToken !== null && !taskIsCurrent(taskToken)) return finish(false);
        const before = sequence.length;
        mergeVisiblePostsOrdered(sequence);
        const grew = sequence.length > previousCount || sequence.length > before || scrollElement.scrollHeight > previousHeight + 20;
        if (grew) finish(true);
      };

      const observer = new MutationObserver(check);
      try { observer.observe(document.body, { childList: true, subtree: true }); } catch (_) {}
      const pollTimer = setInterval(check, 120);
      const deadlineTimer = setTimeout(() => finish(false), maxWait);
      check();
    });
  }

  async function scanOneOrderedPass({ expectedCount, taskToken, pass, hardDeadline }) {
    const scrollElement = document.scrollingElement || document.documentElement || document.body;
    const viewport = Math.max(window.innerHeight || 800, 600);
    const sequence = [];
    const maxMultiplicity = new Map();
    let stagnant = 0;
    let steps = 0;

    try { scrollElement.scrollTo({ top: 0, behavior: 'instant' }); } catch (_) { scrollElement.scrollTop = 0; }
    await sleep(pass === 1 ? 320 : 520);
    { const first = mergeVisiblePostsOrdered(sequence); recordVisibleMultiplicity(maxMultiplicity, first.visible); }

    while (Date.now() < hardDeadline && taskIsCurrent(taskToken) && steps < 110) {
      steps += 1;
      const current = reconcileSequence(sequence, expectedCount, maxMultiplicity);
      reportScanProgress(current.length, expectedCount,
        expectedCount ? `Đang quét chính xác lượt ${pass} • ${current.length}/${expectedCount} bài...` : `Đang quét chính xác lượt ${pass} • ${current.length} bài...`);

      const oldHeight = scrollElement.scrollHeight;
      const oldCount = current.length;
      const maxTop = Math.max(0, oldHeight - viewport);
      const nearBottom = scrollElement.scrollTop >= maxTop - Math.max(90, viewport * 0.08);

      if (nearBottom) {
        try { scrollElement.scrollTo({ top: oldHeight, behavior: 'instant' }); } catch (_) { scrollElement.scrollTop = oldHeight; }
      } else {
        // Bước nhỏ để mỗi card chắc chắn đi qua viewport ít nhất một lần.
        scrollElement.scrollBy({ top: Math.max(260, Math.floor(viewport * 0.48)), behavior: 'instant' });
      }

      await waitForFacebookRender(oldHeight, sequence.length, sequence, nearBottom ? 1450 : 760, taskToken);
      { const merged = mergeVisiblePostsOrdered(sequence); recordVisibleMultiplicity(maxMultiplicity, merged.visible); }
      const after = reconcileSequence(sequence, expectedCount, maxMultiplicity).length;

      if (after > oldCount) stagnant = 0;
      else stagnant += 1;

      if (nearBottom) {
        // Quét bù mép cuối: Facebook thường render 1-2 card cuối muộn hơn.
        for (let bounce = 0; bounce < 3 && taskIsCurrent(taskToken); bounce += 1) {
          const before = reconcileSequence(sequence, expectedCount, maxMultiplicity).length;
          scrollElement.scrollBy({ top: -Math.floor(viewport * (0.28 + bounce * 0.10)), behavior: 'instant' });
          await sleep(220 + bounce * 80);
          { const merged = mergeVisiblePostsOrdered(sequence); recordVisibleMultiplicity(maxMultiplicity, merged.visible); }
          scrollElement.scrollTo({ top: scrollElement.scrollHeight, behavior: 'instant' });
          await sleep(320 + bounce * 100);
          { const merged = mergeVisiblePostsOrdered(sequence); recordVisibleMultiplicity(maxMultiplicity, merged.visible); }
          if (reconcileSequence(sequence, expectedCount, maxMultiplicity).length > before) stagnant = 0;
        }
        if (stagnant >= 2) break;
      }
    }

    return reconcileSequence(sequence, expectedCount, maxMultiplicity);
  }

  async function loadAllPosts(options = {}) {
    const collect = !!options.collect;
    const taskToken = options.taskToken ?? beginTask();
    const expectedCount = getExpectedPendingCount();
    const hardDeadline = Date.now() + 80000;
    let best = [];
    let exact = false;
    let rounds = 0;

    // Mỗi lượt là một lần quét độc lập từ đầu -> cuối. Không cộng dồn Map qua nhiều lượt,
    // vì Facebook virtualize DOM có thể tái sử dụng node và làm một bài bị đếm lặp.
    for (let pass = 1; pass <= 5 && Date.now() < hardDeadline && taskIsCurrent(taskToken); pass += 1) {
      const sequence = await scanOneOrderedPass({ expectedCount, taskToken, pass, hardDeadline });
      rounds += 1;

      // Không bao giờ ưu tiên một lượt quét vượt quá con số Facebook báo.
      // Ví dụ Facebook báo 13 mà một lượt nhận 14 do virtual DOM lặp card: lượt 14/13 bị loại và quét lại.
      if (expectedCount > 0) {
        if (sequence.length === expectedCount) {
          best = sequence;
          exact = true;
          break;
        }
        if (sequence.length < expectedCount && sequence.length > best.length) best = sequence;
      } else if (sequence.length > best.length) {
        best = sequence;
      }
      if (!expectedCount && sequence.length && pass >= 2) {
        best = sequence;
        exact = true;
        break;
      }

      const missing = expectedCount ? Math.max(0, expectedCount - sequence.length) : 0;
      reportScanProgress(sequence.length, expectedCount,
        expectedCount
          ? `Lượt ${pass} thấy ${sequence.length}/${expectedCount} bài${missing ? ` • còn thiếu ${missing}, quét lại từ đầu...` : ' • đang xác minh không lặp...'}`
          : `Lượt ${pass} thấy ${sequence.length} bài • đang xác minh...`);
      await sleep(650 + pass * 120);
    }

    const cancelled = !taskIsCurrent(taskToken);
    if (expectedCount > 0 && best.length === expectedCount) exact = true;

    reportScanProgress(best.length, expectedCount,
      cancelled ? `Đã dừng quét ở ${best.length}${expectedCount ? `/${expectedCount}` : ''} bài.`
        : exact ? `Đã xác thực đủ ${best.length}/${expectedCount || best.length} bài • mỗi bài đúng 1 lần.`
        : expectedCount ? `Đã xác thực ${best.length}/${expectedCount} bài • chưa đủ nên KHÔNG báo quét đủ giả.`
        : `Đã xác thực ${best.length} bài.`);

    return {
      posts: best,
      expectedCount,
      loadComplete: !cancelled && exact,
      rounds,
      stagnantRounds: 0,
      cancelled,
      collect,
    };
  }

  function closestReviewContainer(node) {
    let current = node;
    const maxDepth = 6;
    let depth = 0;
    while (current && depth < maxDepth) {
      const text = normalizeText(current.innerText || '');
      if (/phe duyet|ph[eê] duy[eệ]t|tu choi|t[uừ] ch[oố]i|approve|reject|đăng|dang/.test(text)) {
        return current;
      }
      current = current.parentElement;
      depth += 1;
    }
    return node;
  }

  function cleanAuthorLabel(value) {
    const raw = (value || '').replace(/\s+/g, ' ').trim();
    const t = normalizeText(raw);
    if (!raw || raw.length > 90) return '';
    if (/^(phe duyet|duyet|tu choi|xem them|chia se|thich|binh luan|quan ly|bai viet dang cho|viet lam thoi vu|tim kiem|chon ngay|tac gia|loai noi dung|lien ket|moi nhat truoc|xoa bo loc)/.test(t)) return '';
    if (/^\d+\s*(phut|gio|ngay|tuan|thang)/.test(t)) return '';
    return raw;
  }

  function profileKeyFromHref(href) {
    if (!href) return '';
    try {
      const url = new URL(href, location.origin);
      const path = url.pathname.replace(/\/+$/, '');
      const profileId = url.searchParams.get('id');
      if (/\/profile\.php$/i.test(path) && profileId) return `id:${profileId}`;
      const userMatch = path.match(/\/user\/(\d+)/i);
      if (userMatch) return `id:${userMatch[1]}`;
      const peopleMatch = path.match(/\/people\/[^/]+\/(\d+)/i);
      if (peopleMatch) return `id:${peopleMatch[1]}`;
      const slugMatch = path.match(/^\/([^/]+)$/);
      if (slugMatch) {
        const slug = slugMatch[1].toLowerCase();
        const reserved = new Set(['groups','watch','reel','reels','marketplace','gaming','events','pages','help','settings','notifications','messages','home.php']);
        if (!reserved.has(slug) && !/^\d+$/.test(slug)) return `user:${slug}`;
      }
    } catch (_) {}
    return '';
  }

  function getPostAuthorIdentity(container) {
    const links = Array.from(container.querySelectorAll('a[href]'));
    let nameFallback = '';
    for (const link of links) {
      const label = cleanAuthorLabel(link.innerText || link.textContent || link.getAttribute('aria-label') || '');
      if (!label) continue;
      if (!nameFallback) nameFallback = label;
      const href = link.href || link.getAttribute('href') || '';
      const key = profileKeyFromHref(href);
      if (key) return { name: normalizeText(label), displayName: label, key, confident: true };
    }

    // Fallback chỉ dùng tên để hiển thị; KHÔNG dùng để loại bài trùng người đăng.
    const lines = (container.innerText || '').split('\n').map((line) => cleanAuthorLabel(line)).filter(Boolean);
    const displayName = nameFallback || lines[0] || '';
    return { name: normalizeText(displayName), displayName, key: '', confident: false };
  }

  function getPostAuthor(container) {
    return getPostAuthorIdentity(container).name;
  }

  function isUsableActionElement(el) {
    if (!el || !el.isConnected) return false;
    if (el.disabled === true) return false;
    if (normalizeText(el.getAttribute?.('aria-disabled') || '') === 'true') return false;
    try {
      const rect = el.getBoundingClientRect();
      if (rect.width < 18 || rect.height < 12) return false;
    } catch (_) {}
    return true;
  }

  function getActionCandidates(root = document, kind = 'ANY') {
    const selector = 'button, div[role="button"], span[role="button"], a[role="button"]';
    const pattern = kind === 'APPROVE'
      ? /^(đăng|dang|phê duyệt|phe duyet|duyệt|duyet|approve|post|publish)$/i
      : kind === 'REJECT'
        ? /^(từ chối|tu choi|reject|decline)$/i
        : /^(đăng|dang|phê duyệt|phe duyet|duyệt|duyet|approve|post|publish|từ chối|tu choi|reject|decline)$/i;
    return Array.from(root.querySelectorAll(selector)).filter((el) => isUsableActionElement(el) && pattern.test(getButtonText(el)));
  }

  function findReviewContainerFromAction(button) {
    let current = button;
    let fallback = null;
    for (let depth = 0; current && current !== document.body && depth < 16; depth += 1, current = current.parentElement) {
      const text = normalizeText(current.innerText || '');
      if (text.length < 18) continue;
      const approveCount = getActionCandidates(current, 'APPROVE').length;
      const rejectCount = getActionCandidates(current, 'REJECT').length;

      // Card bài chờ chuẩn có đúng một cặp Phê duyệt/Từ chối.
      if (approveCount === 1 && rejectCount === 1) {
        const identity = getPostAuthorIdentity(current);
        const headerOnly = /bai viet dang cho/.test(text) && !identity.displayName;
        if (!headerOnly && (identity.displayName || text.length >= 45)) return current;
      }

      if (!fallback && approveCount + rejectCount >= 1 && approveCount <= 1 && rejectCount <= 1 && text.length >= 40) {
        fallback = current;
      }
      // Một ancestor có nhiều cặp hành động là vùng chứa nhiều card, dừng leo để không gộp card.
      if (approveCount > 2 || rejectCount > 2) break;
    }
    return fallback;
  }

  function isLikelyRealPendingCard(container, approveButton, rejectButton, authorIdentity) {
    if (!container || (!approveButton && !rejectButton)) return false;
    const text = normalizeText(container.innerText || '');
    if (text.length < 20) return false;
    if (/^bai viet dang cho\b/.test(text) && !authorIdentity?.displayName) return false;
    if (/chon ngay|tac gia|loai noi dung|xoa bo loc/.test(text) && !authorIdentity?.displayName) return false;
    // Header duyệt hàng loạt của Facebook không có tác giả bài viết.
    if (!authorIdentity?.displayName && !getPostPermalink(container) && !getStrongPostIdentity(container)) return false;
    return true;
  }

  function collectPostNodes() {
    const cards = [];
    const seenContainers = new Set();

    // Pending feed: bắt đầu từ từng nút Phê duyệt thực sự. Loại hẳn nút batch bị disabled ở đầu trang.
    const approveSeeds = getActionCandidates(document, 'APPROVE');
    const rejectSeeds = getActionCandidates(document, 'REJECT');
    const seeds = [...approveSeeds, ...rejectSeeds];

    for (const button of seeds) {
      const container = findReviewContainerFromAction(button);
      if (!container || seenContainers.has(container)) continue;

      const approveButton = findActionButton(container, /^(đăng|dang|phê duyệt|phe duyet|duyệt|duyet|approve|post|publish)$/i);
      const rejectButton = findActionButton(container, /^(từ chối|tu choi|reject|decline)$/i);
      if (!isUsableActionElement(approveButton) && !isUsableActionElement(rejectButton)) continue;

      const authorIdentity = getPostAuthorIdentity(container);
      if (!isLikelyRealPendingCard(container, approveButton, rejectButton, authorIdentity)) continue;
      seenContainers.add(container);

      const rawText = container.innerText || '';
      const text = normalizeText(rawText);
      const author = authorIdentity.name;
      const summary = text.slice(0, 220).replace(/\s+/g, ' ') + '...';
      const isSharedPost = isSharedFromAnotherGroup(text);
      const externalGroupRepost = hasExternalGroupPostLink(container);
      const externalGroupShare = isSharedPost || externalGroupRepost;
      const duplicateKey = getDuplicateContentKey(text, author);
      const permalink = getPostPermalink(container);
      const strongIdentity = getStrongPostIdentity(container, permalink);
      const mediaIdentity = getMediaIdentityHints(container);
      const postAgeMinutes = externalGroupShare ? null : extractPostAgeMinutesFromContainer(container, rawText);
      // Bài share từ Group khác đã chắc chắn bị từ chối nên không đọc thêm thông tin tài khoản.
      const accountAgeDays = externalGroupShare ? null : extractAccountAgeDays(rawText);
      const noProfilePhoto = externalGroupShare ? null : getProfilePhotoState(container, authorIdentity);
      const domIdentity = getDomIdentityHints(container);

      cards.push({
        element: container, text, author,
        authorKey: authorIdentity.key || '', authorConfident: !!authorIdentity.confident,
        summary, isSharedPost, externalGroupRepost, duplicateKey,
        permalink, strongIdentity, mediaIdentity, domIdentity,
        postAgeMinutes, accountAgeDays, noProfilePhoto,
        approveButton: isUsableActionElement(approveButton) ? approveButton : null,
        rejectButton: isUsableActionElement(rejectButton) ? rejectButton : null,
      });
    }

    // DOM order thật của Facebook = thứ tự bài trong hàng chờ.
    cards.sort((a, b) => getPageY(a.element) - getPageY(b.element));
    return cards;
  }

  function evaluatePost(post) {
    if (isSpamSection) {
      return { decision: 'REJECT', category: 'SPAM_SECTION', score: 0, reason: 'Đang ở mục spam của Facebook.' };
    }

    // Ưu tiên tuyệt đối: share/repost từ Group khác -> REJECT ngay.
    // Không chạy các rule nội dung/tài khoản phía dưới.
    if (post?.isSharedPost === true || post?.externalGroupRepost === true) {
      return externalGroupShareVerdict();
    }

    const text = post.text || '';
    const isFindJob = containsAny(text, RULES.findJobTriggers);
    const isRecruitment = containsAny(text, RULES.recruitmentTriggers)
      || /(?:^|\s)(?:tuyen|can tuyen|tuyen dung|tuyen gap)(?:\s|$)/.test(text);
    const jobContext = isFindJob || isRecruitment;
    const loanRisk = containsAny(text, RULES.loanScamTriggers);
    const policyRisk = containsAny(text, RULES.policyRiskTriggers);
    const obviousSpam = containsAny(text, RULES.spamTriggers);
    const suspiciousJobSignals = countMatchedSignals(text, RULES.suspiciousRecruitmentTriggers);
    const commerceSignals = countMatchedSignals(text, RULES.commerceStrongTriggers);
    const jobSalesRole = looksLikeJobSalesRole(text);
    const externalRepost = post.isSharedPost === true || post.externalGroupRepost === true;
    const under30Days = Number.isFinite(post.accountAgeDays) && post.accountAgeDays < 30;
    const noAvatar = post.noProfilePhoto === true;

    // Rủi ro nặng: vay vốn/giải ngân/đặt cọc/phí nhận việc hoặc nội dung dễ gây hại cho nhóm.
    if (loanRisk) {
      return {
        decision: 'REJECT', category: 'LOAN_SCAM_RISK', score: 0,
        reason: 'Từ chối ngay: có dấu hiệu vay vốn/giải ngân/thu phí/đặt cọc hoặc chuyển tiền trước — rủi ro lừa đảo.'
      };
    }
    if (policyRisk) {
      return {
        decision: 'REJECT', category: 'POLICY_RISK', score: 0,
        reason: 'Từ chối ngay: nội dung có dấu hiệu rủi ro cao, có thể ảnh hưởng an toàn hoặc chất lượng của nhóm.'
      };
    }

    // Quảng cáo/buôn bán: chỉ chặn khi thực sự là bán sản phẩm/dịch vụ, không chặn nghề "nhân viên bán hàng/sales".
    if (!jobSalesRole && (commerceSignals >= 2 || /(?:can ban|thanh ly|dat hang|ship toan quoc|inbox dat hang|gia chi)\b/.test(text))) {
      return {
        decision: 'REJECT', category: 'COMMERCE_AD', score: 0,
        reason: 'Từ chối ngay: bài có dấu hiệu buôn bán/quảng cáo sản phẩm hoặc dịch vụ, không phải tin việc làm.'
      };
    }

    // Tuyển dụng online kiểu hoa hồng/chốt đơn/việc nhẹ lương cao: chặn theo tổng hợp tín hiệu, không chỉ một từ đơn lẻ.
    if (obviousSpam && (suspiciousJobSignals > 0 || commerceSignals > 0 || !jobContext)) {
      return {
        decision: 'REJECT', category: 'SCAMMY_JOB_AD', score: 0,
        reason: 'Từ chối ngay: nội dung mang nhiều dấu hiệu spam/lừa đảo hoặc quảng cáo việc làm không đáng tin.'
      };
    }
    if (suspiciousJobSignals >= 2) {
      return {
        decision: 'REJECT', category: 'SUSPICIOUS_RECRUITMENT', score: 0,
        reason: 'Từ chối ngay: tin tuyển dụng có nhiều dấu hiệu bất thường (online/hoa hồng/thu nhập quá dễ hoặc tương tự).'
      };
    }

    // Nick mới/không avatar không còn là lý do từ chối độc lập. Chỉ dùng như tín hiệu bổ sung khi nội dung cũng đáng ngờ.
    if ((under30Days || noAvatar) && suspiciousJobSignals > 0) {
      return {
        decision: 'REJECT', category: 'SUSPICIOUS_ACCOUNT_AND_CONTENT', score: 0,
        reason: 'Từ chối: tài khoản có dấu hiệu rủi ro và nội dung đồng thời có tín hiệu tuyển dụng đáng ngờ.'
      };
    }

    // Bài việc làm/tìm việc bình thường: duyệt theo nội dung thực tế, không cần khớp một bộ rule cứng.
    if (jobContext) {
      return {
        decision: 'APPROVE', category: isFindJob ? 'FIND_JOB_SAFE' : 'RECRUIT_SAFE', score: 100,
        reason: isFindJob
          ? 'Duyệt: bài tìm việc/ứng viên, không phát hiện dấu hiệu rủi ro.'
          : 'Duyệt: bài tuyển dụng/việc làm, không phát hiện dấu hiệu lừa đảo, vay vốn, buôn bán hay quảng cáo nguy hiểm.'
      };
    }

    // Bài không thuộc việc làm mà mang tính quảng bá/repost thì loại; còn lại giữ lại để admin xem, tránh từ chối nhầm.
    if (externalRepost || commerceSignals > 0 || obviousSpam) {
      return {
        decision: 'REJECT', category: 'OFFTOPIC_PROMO', score: 0,
        reason: 'Từ chối: nội dung không rõ là việc làm và có dấu hiệu quảng cáo/spam/repost.'
      };
    }

    return {
      decision: 'REJECT', category: 'UNCLEAR_REJECT', score: 0,
      reason: 'Từ chối: nội dung chưa đủ rõ ràng hoặc không đủ thông tin để xác nhận là bài việc làm an toàn/phù hợp nhóm.'
    };
  }

  function resolveClickable(button) {
    if (!button) return null;
    if (button.matches?.('button,[role="button"],a[role="button"]')) return button;
    return button.closest?.('button,[role="button"],a[role="button"]') || button;
  }

  function firePointerClick(target) {
    if (!target) return false;
    const rect = target.getBoundingClientRect?.();
    const clientX = rect ? rect.left + Math.max(2, rect.width / 2) : 1;
    const clientY = rect ? rect.top + Math.max(2, rect.height / 2) : 1;
    const common = { bubbles: true, cancelable: true, composed: true, view: window, clientX, clientY, button: 0, buttons: 1 };
    try { target.dispatchEvent(new PointerEvent('pointerdown', { ...common, pointerId: 1, pointerType: 'mouse', isPrimary: true })); } catch (_) {}
    try { target.dispatchEvent(new MouseEvent('mousedown', common)); } catch (_) {}
    try { target.dispatchEvent(new PointerEvent('pointerup', { ...common, pointerId: 1, pointerType: 'mouse', isPrimary: true, buttons: 0 })); } catch (_) {}
    try { target.dispatchEvent(new MouseEvent('mouseup', { ...common, buttons: 0 })); } catch (_) {}
    try { target.dispatchEvent(new MouseEvent('click', { ...common, buttons: 0 })); return true; } catch (_) {}
    return false;
  }

  function clickButton(button) {
    const target = resolveClickable(button);
    if (!target || !target.isConnected) return false;
    try { target.scrollIntoView({ behavior: 'instant', block: 'center', inline: 'nearest' }); } catch (_) {}
    try { target.focus({ preventScroll: true }); } catch (_) {}
    try {
      target.click();
      return true;
    } catch (_) {
      return firePointerClick(target);
    }
  }

  async function waitForActionApplied(container, button, timeout = 1400) {
    const started = Date.now();
    while (Date.now() - started < timeout) {
      await sleep(120);
      if (!button?.isConnected || !container?.isConnected) return true;
      const actionStillThere = !!findActionButton(container, /^(đăng|dang|phê duyệt|phe duyet|duyệt|duyet|approve|post|publish|từ chối|tu choi|reject|decline)$/i);
      if (!actionStillThere) return true;
    }
    return false;
  }

  async function clickButtonWithDelay(button, delay = 320, container = null) {
    let target = resolveClickable(button);
    if (!target || !target.isConnected) return false;
    const host = container || target.closest?.('article,[role="article"],[data-pagelet]') || target.parentElement;

    let clicked = clickButton(target);
    if (!clicked) return false;
    let applied = await waitForActionApplied(host, target, 900);

    if (!applied && target.isConnected) {
      firePointerClick(target);
      applied = await waitForActionApplied(host, target, 900);
    }

    await sleep(Math.max(100, delay));
    // Không coi việc dispatch click là thành công. Chỉ true khi card/nút thực sự biến đổi trên Facebook.
    return applied === true;
  }

  function requestAiClassifications(posts) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ action: 'classifyPosts', posts }, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        if (!response) {
          reject(new Error('Không nhận được phản hồi từ background.'));
          return;
        }
        if (response.error) {
          reject(new Error(response.error));
          return;
        }
        resolve(response.results || []);
      });
    });
  }

  async function getAiDecisionsForPosts(posts, timeoutMs = 4500) {
    if (!isPendingSection || posts.length === 0) {
      return { results: null, error: null };
    }

    const payload = posts.map((post, index) => ({ id: index, text: post.text.slice(0, 1500) }));
    try {
      const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('AI timeout')), timeoutMs));
      const results = await Promise.race([requestAiClassifications(payload), timeout]);
      if (Array.isArray(results) && results.length === posts.length) return { results, error: null };
      return { results: null, error: 'AI trả về kết quả không hợp lệ.' };
    } catch (error) {
      return { results: null, error: error.message || 'AI classification failed' };
    }
  }

  function mergeAiDecision(post, aiDecision) {
    // Quyết định chính dựa trên nội dung/rủi ro cục bộ để chạy nhanh và ổn định.
    // AI chỉ là tùy chọn chẩn đoán, không được ghi đè thao tác tự động.
    return evaluatePost(post);
  }

  async function scanPendingPosts() {
    const taskToken = beginTask();
    const loadResult = await loadAllPosts({ collect: true, taskToken });
    if (loadResult.cancelled || !taskIsCurrent(taskToken)) {
      return { posts: [], expectedCount: loadResult.expectedCount, scannedCount: loadResult.posts.length, loadComplete: false, cancelled: true };
    }

    const nodes = loadResult.posts;
    reportScanProgress(nodes.length, loadResult.expectedCount, 'Đã tải xong — đang đối chiếu nội dung + giới hạn 1 bài/24 giờ...');
    const moderationPlan = await build24hModerationPlan(nodes);
    const posts = nodes.map((post, index) => {
      const verdict = moderationPlan.decisionsByPost?.get(post) || moderationPlan.decisions.get(getStablePostKey(post)) || evaluatePost(post);
      let finalDecision = verdict.decision;
      let finalReason = verdict.reason;

      return {
        id: index + 1,
        author: post.author || null,
        authorKey: post.authorKey || '',
        summary: post.summary,
        decision: finalDecision,
        category: verdict.category || '',
        reason: finalReason,
        postKey: getStablePostKey(post),
        permalink: post.permalink || '',
        strongIdentity: post.strongIdentity || '',
        mediaIdentity: post.mediaIdentity || '',
        domIdentity: post.domIdentity || '',
        contentFingerprint: cleanPostBodyForFingerprint(post).slice(0, 900),
        authorConfident: !!post.authorConfident,
        approveButtonExists: !!post.approveButton,
        rejectButtonExists: !!post.rejectButton,
        aiDecision: null,
      };
    });

    return {
      posts,
      pageApproveCount: findActionButtons(/^(đăng|dang|phê duyệt|phe duyet|duyệt|duyet|approve|post|publish)$/i).length,
      pageRejectCount: findActionButtons(/^(từ chối|tu choi|reject|decline)$/i).length,
      aiError: null,
      expectedCount: loadResult.expectedCount,
      scannedCount: nodes.length,
      loadComplete: loadResult.loadComplete,
      cancelled: false,
    };
  }

  async function sendDailyLimitNotice(post) {
    const notice = 'Mỗi thành viên chỉ được đăng tối đa 1 bài trong vòng 24 giờ';
    await sleep(260);

    // Facebook thường giữ card sau khi từ chối và hiện nút "Nhắn tin cho ...".
    const scope = post.element?.isConnected ? post.element : document;
    let messageButton = findActionButton(scope, /^(nhắn tin(?: cho .*)?|nhan tin(?: cho .*)?|message(?: .*)?)$/i);
    if (!messageButton && scope !== document) {
      const candidates = Array.from(document.querySelectorAll('button,[role="button"]')).filter((el) => {
        const txt = getButtonText(el);
        return /^(nhan tin|message)\b/.test(txt) && (!post.author || txt.includes(normalizeText(post.author)));
      });
      messageButton = candidates[0];
    }
    if (!messageButton || !clickButton(messageButton)) return false;
    await sleep(420);

    const dialog = document.querySelector('[role="dialog"]') || document;
    const input = dialog.querySelector('textarea, [contenteditable="true"][role="textbox"], [contenteditable="true"]');
    if (!input) return false;
    try {
      input.focus();
      if ('value' in input) {
        input.value = notice;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      } else {
        input.textContent = notice;
        input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: notice }));
      }
    } catch (_) { return false; }
    await sleep(180);

    const sendButton = findActionButton(dialog, /^(gửi|gui|send)$/i);
    if (!sendButton) return false;
    return clickButton(sendButton);
  }

  async function dismissLingeringApproveDialogs() {
    const dialogs = Array.from(document.querySelectorAll('[role="dialog"]'));
    for (const dialog of dialogs) {
      const txt = normalizeText(dialog.innerText || '');
      // Bản cũ có thể để lại hộp Nhắn tin sau khi từ chối bài giới hạn 24 giờ.
      // Hộp này chặn toàn bộ click Phê duyệt/Từ chối phía sau.
      if (!/(nhan tin|message|moi thanh vien chi duoc dang toi da 1 bai|24 gio)/.test(txt)) continue;
      const closePattern = /^(đóng|dong|close|x|×)$/i;
      const close = findActionButton(dialog, closePattern)
        || Array.from(dialog.querySelectorAll('button,[role="button"]')).find((el) => closePattern.test(getButtonText(el)));
      if (close && isUsableActionElement(close)) {
        clickButton(close);
        await sleep(220);
        continue;
      }
      try {
        dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27, which: 27, bubbles: true }));
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27, which: 27, bubbles: true }));
      } catch (_) {}
      await sleep(180);
    }
  }

  async function locatePostForAuto(target, taskToken) {
    if (!taskIsCurrent(taskToken)) return null;

    await dismissLingeringApproveDialogs();
    let found = findBestVisiblePost(target);
    if (found?.element) return found;

    const scrollElement = document.scrollingElement || document.documentElement || document.body;
    const viewport = Math.max(window.innerHeight || 760, 600);

    // Facebook virtualize danh sách. Quét 2 lượt từ đầu xuống, lượt 2 chậm hơn để
    // kích hoạt lazy-load nếu lượt đầu chưa dựng đủ card vào DOM.
    for (let pass = 0; pass < 2 && taskIsCurrent(taskToken); pass += 1) {
      try { scrollElement.scrollTo({ top: 0, behavior: 'instant' }); } catch (_) { scrollElement.scrollTop = 0; }
      await sleep(pass === 0 ? 280 : 700);

      let stagnant = 0;
      let lastHeight = scrollElement.scrollHeight;
      for (let step = 0; step < 55 && taskIsCurrent(taskToken); step += 1) {
        found = findBestVisiblePost(target);
        if (found?.element) return found;

        const maxTop = Math.max(0, scrollElement.scrollHeight - viewport);
        const before = scrollElement.scrollTop;
        if (before >= maxTop - 70) {
          // Chạm đáy: chờ Facebook nạp thêm, bounce nhẹ rồi kiểm tra lại.
          await sleep(pass === 0 ? 650 : 1050);
          found = findBestVisiblePost(target);
          if (found?.element) return found;
          const newHeight = scrollElement.scrollHeight;
          if (newHeight <= lastHeight + 20) stagnant += 1;
          else stagnant = 0;
          lastHeight = newHeight;
          if (stagnant >= 2) break;
          try { scrollElement.scrollBy({ top: -Math.floor(viewport * .38), behavior: 'instant' }); } catch (_) {}
          await sleep(260);
          try { scrollElement.scrollTo({ top: scrollElement.scrollHeight, behavior: 'instant' }); } catch (_) {}
          continue;
        }

        const stepSize = Math.max(300, Math.floor(viewport * (pass === 0 ? .68 : .52)));
        try { scrollElement.scrollTo({ top: Math.min(maxTop, before + stepSize), behavior: 'instant' }); }
        catch (_) { scrollElement.scrollTop = Math.min(maxTop, before + stepSize); }
        await sleep(pass === 0 ? 260 : 380);
      }
    }
    return null;
  }

  async function waitForSpecificActionApplied(container, button, beforePendingCount, taskToken, timeout = 3200) {
    const started = Date.now();
    while (Date.now() - started < timeout && taskIsCurrent(taskToken)) {
      await sleep(140);
      if (!container?.isConnected || !button?.isConnected) return true;

      const nowPending = getExpectedPendingCount();
      if (beforePendingCount > 0 && nowPending > 0 && nowPending < beforePendingCount) return true;

      const approveStill = getActionCandidates(container, 'APPROVE').length > 0;
      const rejectStill = getActionCandidates(container, 'REJECT').length > 0;
      if (!approveStill && !rejectStill) return true;
    }
    return false;
  }

  async function performVerifiedModerationAction(snapshot, decision, taskToken) {
    let lastReason = '';
    const pattern = decision === 'APPROVE'
      ? /^(đăng|dang|phê duyệt|phe duyet|duyệt|duyet|approve|post|publish)$/i
      : /^(từ chối|tu choi|reject|decline)$/i;

    for (let attempt = 1; attempt <= 2 && taskIsCurrent(taskToken); attempt += 1) {
      await dismissLingeringApproveDialogs();
      const current = await locatePostForAuto(snapshot, taskToken);
      if (!current?.element) {
        lastReason = 'Không tìm lại được đúng card bài trên Facebook.';
        if (attempt < 2) await sleep(650);
        continue;
      }

      try { current.element.scrollIntoView({ behavior: 'instant', block: 'center', inline: 'nearest' }); } catch (_) {}
      await sleep(260);

      // Luôn lấy lại nút sau scroll vì React có thể thay node ngay khi card vào viewport.
      let button = decision === 'APPROVE'
        ? findActionButton(current.element, pattern)
        : findActionButton(current.element, pattern);
      if (!isUsableActionElement(button)) {
        lastReason = `Không tìm thấy nút ${decision === 'APPROVE' ? 'Phê duyệt' : 'Từ chối'} của đúng bài.`;
        if (attempt < 2) await sleep(520);
        continue;
      }

      const beforePendingCount = getExpectedPendingCount();
      if (!clickButton(button)) {
        lastReason = 'Không thể gửi thao tác click tới Facebook.';
        if (attempt < 2) await sleep(520);
        continue;
      }

      await sleep(420);
      let applied = await waitForSpecificActionApplied(current.element, button, beforePendingCount, taskToken, 2600);

      // Một số layout mở dialog xác nhận. Chỉ bấm nút xác nhận trong chính dialog đó.
      if (!applied && taskIsCurrent(taskToken)) {
        const dialogs = Array.from(document.querySelectorAll('[role="dialog"]'));
        for (const dialog of dialogs) {
          let confirm = findActionButton(dialog, pattern);
          if (!confirm) {
            const generic = /^(xác nhận|xac nhan|confirm|tiếp tục|tiep tuc|continue)$/i;
            confirm = findActionButton(dialog, generic);
          }
          if (confirm && confirm !== button && isUsableActionElement(confirm)) {
            clickButton(confirm);
            applied = await waitForSpecificActionApplied(current.element, button, beforePendingCount, taskToken, 3200);
            if (applied) break;
          }
        }
      }

      // React đôi khi bỏ .click() đầu tiên; pointer click là phương án cuối.
      if (!applied && taskIsCurrent(taskToken) && button?.isConnected) {
        firePointerClick(resolveClickable(button));
        applied = await waitForSpecificActionApplied(current.element, button, beforePendingCount, taskToken, 3200);
      }

      if (applied) {
        await sleep(520);
        await dismissLingeringApproveDialogs();
        return { ok: true, attempts: attempt };
      }

      lastReason = 'Facebook chưa xác nhận thao tác; sẽ thử tìm lại card.';
      await sleep(700);
    }

    return { ok: false, reason: lastReason || 'Không thể thao tác bài sau 2 lần thử.' };
  }

  async function executeScannedModerationPlan(plan = []) {
    const taskToken = beginTask();
    const snapshots = Array.isArray(plan) ? plan.filter(Boolean) : [];
    const results = new Array(snapshots.length);
    let approvedCount = 0;
    let rejectedCount = 0;
    const total = snapshots.length;

    if (!total) {
      reportScanProgress(0, 0, '⚠️ Chưa có danh sách Scan để thao tác.');
      return [];
    }

    // Đóng hộp Nhắn tin còn sót từ bản cũ. Từ 1.42.60 không mở hộp nhắn tin trong lúc chạy batch,
    // vì modal này có thể chặn toàn bộ 32+ thao tác tiếp theo.
    await dismissLingeringApproveDialogs();
    reportScanProgress(0, total, `▶️ Bắt đầu thao tác đúng ${total} bài đã Scan • không phân loại lại.`);

    const failedIndexes = [];
    const applyIndex = async (index, recoveryRound = 0) => {
      const snapshot = snapshots[index];
      const finalDecision = String(snapshot.decision || '').toUpperCase() === 'APPROVE' ? 'APPROVE' : 'REJECT';
      const finalReason = snapshot.reason || '';
      const key = snapshot.postKey || `scan:${index + 1}`;

      const action = await performVerifiedModerationAction(snapshot, finalDecision, taskToken);
      let actionTaken = '';
      if (action.ok) {
        if (finalDecision === 'APPROVE') {
          approvedCount += 1;
          actionTaken = 'Đã duyệt';
          if (snapshot.authorKey) await saveApprovedAuthorWithin24h(snapshot.authorKey, snapshot);
        } else {
          rejectedCount += 1;
          actionTaken = 'Đã từ chối';
          // Không tự mở hộp Nhắn tin ở đây. Việc nhắn thông báo 24h từng làm modal Facebook
          // che lớp bài chờ và khiến hàng loạt bài phía sau không thể click.
        }
      } else {
        actionTaken = `Chưa thao tác được: ${action.reason}`;
      }

      results[index] = {
        ...snapshot,
        id: snapshot.id || index + 1,
        decision: finalDecision,
        reason: finalReason,
        actionTaken,
        postKey: key,
        recoveryRound,
      };
      return action.ok;
    };

    for (let index = 0; index < snapshots.length && taskIsCurrent(taskToken); index += 1) {
      reportScanProgress(index, total, `Đang xử lý ${index + 1}/${total} • ${approvedCount} duyệt • ${rejectedCount} từ chối...`);
      const ok = await applyIndex(index, 0);
      if (!ok) failedIndexes.push(index);
      reportScanProgress(index + 1, total, `Đã đi qua ${index + 1}/${total} • ${approvedCount} duyệt • ${rejectedCount} từ chối${failedIndexes.length ? ` • ${failedIndexes.length} chờ thử lại` : ''}`);
    }

    // Recovery: chỉ thử lại đúng các snapshot bị lỗi, KHÔNG scan/phân loại lại.
    let remaining = failedIndexes.slice();
    for (let round = 1; round <= 2 && remaining.length && taskIsCurrent(taskToken); round += 1) {
      reportScanProgress(total - remaining.length, total, `🔄 Thử lại lần ${round}: ${remaining.length} bài Facebook chưa nhận thao tác...`);
      await dismissLingeringApproveDialogs();
      await sleep(800);
      const next = [];
      for (let j = 0; j < remaining.length && taskIsCurrent(taskToken); j += 1) {
        const index = remaining[j];
        const ok = await applyIndex(index, round);
        if (!ok) next.push(index);
        reportScanProgress(total - next.length - (remaining.length - j - 1), total, `🔄 Lần ${round}: còn ${next.length + (remaining.length - j - 1)} bài cần thử • ${approvedCount} duyệt • ${rejectedCount} từ chối`);
      }
      remaining = next;
    }

    const finalResults = results.filter(Boolean);
    reportScanProgress(
      finalResults.length,
      total,
      taskIsCurrent(taskToken)
        ? `✅ Xong danh sách Scan: ${approvedCount} duyệt • ${rejectedCount} từ chối${remaining.length ? ` • ${remaining.length} bài Facebook vẫn chưa nhận thao tác` : ' • đã xử lý toàn bộ'}.`
        : 'Đã dừng thao tác theo danh sách Scan.'
    );
    return finalResults;
  }

  async function runAutoModeration() {
    const taskToken = beginTask();
    const initialExpected = getExpectedPendingCount();
    const results = [];
    let approvedCount = 0;
    let rejectedCount = 0;
    let skippedCount = 0;

    // BẮT BUỘC có snapshot chính xác trước khi bấm bất kỳ bài nào.
    // Nhờ vậy Auto không thể chạy thành 14/13 hoặc thao tác nhầm card do Facebook tái sử dụng DOM.
    reportScanProgress(0, initialExpected, 'Đang xác thực chính xác danh sách bài trước khi tự động duyệt...');
    const preflight = await loadAllPosts({ collect: true, taskToken });
    if (preflight.cancelled || !taskIsCurrent(taskToken)) return results;

    const expectedCount = Number(preflight.expectedCount || initialExpected || 0);
    if (expectedCount > 0 && (preflight.loadComplete !== true || preflight.posts.length !== expectedCount)) {
      reportScanProgress(
        Math.min(preflight.posts.length, expectedCount),
        expectedCount,
        `⚠️ Dừng Auto: chỉ xác thực được ${preflight.posts.length}/${expectedCount} bài chính xác. Không bấm để tránh duyệt/từ chối nhầm.`
      );
      return results;
    }

    const snapshots = preflight.posts.slice();
    const moderationPlan = await build24hModerationPlan(snapshots);
    const total = snapshots.length;

    for (let index = 0; index < snapshots.length && taskIsCurrent(taskToken); index += 1) {
      const snapshot = snapshots[index];
      const key = getStablePostKey(snapshot);
      const verdict = moderationPlan.decisionsByPost?.get(snapshot) || moderationPlan.decisions.get(key) || evaluatePost(snapshot);
      const finalDecision = verdict.decision === 'APPROVE' ? 'APPROVE' : 'REJECT';
      const finalReason = verdict.reason || '';

      reportScanProgress(
        index,
        total,
        `Đang xử lý bài ${index + 1}/${total} • ${approvedCount} duyệt • ${rejectedCount} từ chối...`
      );

      const action = await performVerifiedModerationAction(snapshot, finalDecision, taskToken);
      let actionTaken = '';
      if (action.ok) {
        if (finalDecision === 'APPROVE') {
          approvedCount += 1;
          actionTaken = 'Đã duyệt';
          if (snapshot.authorKey) await saveApprovedAuthorWithin24h(snapshot.authorKey, snapshot);
        } else {
          rejectedCount += 1;
          actionTaken = 'Đã từ chối';
          // 1.42.60: không mở hộp Nhắn tin trong batch; modal có thể chặn các thao tác kế tiếp.
        }
      } else {
        skippedCount += 1;
        actionTaken = `Chưa thao tác được: ${action.reason}`;
      }

      results.push({
        id: results.length + 1,
        author: snapshot.author || null,
        authorKey: snapshot.authorKey || '',
        summary: snapshot.summary,
        decision: finalDecision,
        reason: finalReason,
        actionTaken,
        postKey: key,
        permalink: snapshot.permalink || '',
        aiDecision: null,
      });

      reportScanProgress(
        index + 1,
        total,
        `Đã xử lý ${index + 1}/${total} • ${approvedCount} duyệt • ${rejectedCount} từ chối${skippedCount ? ` • ${skippedCount} lỗi thao tác` : ''}`
      );
    }

    reportScanProgress(
      results.length,
      total,
      taskIsCurrent(taskToken)
        ? `✅ Xong: ${approvedCount} duyệt • ${rejectedCount} từ chối${skippedCount ? ` • ${skippedCount} chưa thao tác được` : ''} • ${results.length}/${total} bài.`
        : 'Đã dừng tự động duyệt.'
    );
    return results;
  }

  function flashLocatedPost(container) {
    if (!container) return;
    const oldOutline = container.style.outline;
    const oldOutlineOffset = container.style.outlineOffset;
    const oldTransition = container.style.transition;
    container.style.transition = 'outline-color .2s ease';
    container.style.outline = '4px solid #22c55e';
    container.style.outlineOffset = '4px';
    setTimeout(() => {
      try {
        container.style.outline = oldOutline;
        container.style.outlineOffset = oldOutlineOffset;
        container.style.transition = oldTransition;
      } catch (_) {}
    }, 2600);
  }

  function scorePostMatch(post, target) {
    if (!post || !target) return 0;

    const wantedKey = String(target.postKey || '');
    const stableKey = getStablePostKey(post);
    if (wantedKey && stableKey === wantedKey) return 2200;

    const wantedStrong = String(target.strongIdentity || '');
    const postStrong = String(post.strongIdentity || getStrongPostIdentity(post.element, post.permalink || '') || '');
    if (wantedStrong && postStrong && wantedStrong === postStrong) return 2100;

    const wantedLink = String(target.permalink || '').split('#')[0];
    const postLink = String(post.permalink || '').split('#')[0];
    if (wantedLink && postLink && (postLink === wantedLink || postLink.includes(wantedLink) || wantedLink.includes(postLink))) return 1900;

    let score = 0;
    const wantedAuthorKey = String(target.authorKey || '');
    const postAuthorKey = String(post.authorKey || '');
    if (wantedAuthorKey && postAuthorKey && wantedAuthorKey === postAuthorKey) score += 420;

    const wantedMedia = new Set(String(target.mediaIdentity || '').split('|').filter(Boolean));
    const postMedia = new Set(String(post.mediaIdentity || getMediaIdentityHints(post.element) || '').split('|').filter(Boolean));
    if (wantedMedia.size && postMedia.size) {
      let hits = 0;
      for (const id of wantedMedia) if (postMedia.has(id)) hits += 1;
      score += hits * 380;
    }

    const wantedAuthor = normalizeText(target.author || '');
    const postAuthor = normalizeText(post.author || '');
    if (wantedAuthor && postAuthor && wantedAuthor === postAuthor) score += 180;
    else if (wantedAuthor && postAuthor && (postAuthor.includes(wantedAuthor) || wantedAuthor.includes(postAuthor))) score += 90;

    const wantedBody = normalizeText(target.contentFingerprint || '');
    const postBody = normalizeText(cleanPostBodyForFingerprint(post));
    if (wantedBody && postBody) {
      if (wantedBody === postBody) score += 1000;
      else if (postBody.includes(wantedBody.slice(0, Math.min(160, wantedBody.length))) || wantedBody.includes(postBody.slice(0, Math.min(160, postBody.length)))) score += 620;
      else {
        const words = [...new Set(wantedBody.split(' ').filter((x) => x.length >= 4))].slice(0, 28);
        const hits = words.filter((word) => postBody.includes(word)).length;
        score += hits * 24;
      }
    }

    const wantedSummary = normalizeText(target.summary || '').replace(/\.\.\.$/, '').slice(0, 150);
    const postText = normalizeText(post.text || '');
    if (wantedSummary && postText.includes(wantedSummary)) score += 650;
    else if (wantedSummary) {
      const words = [...new Set(wantedSummary.split(' ').filter((x) => x.length >= 4))].slice(0, 18);
      const hits = words.filter((word) => postText.includes(word)).length;
      score += hits * 18;
    }
    return score;
  }

  function findBestVisiblePost(target) {
    const posts = collectPostNodes();
    let best = null;
    let bestScore = 0;
    for (const post of posts) {
      const score = scorePostMatch(post, target);
      if (score > bestScore) {
        best = post;
        bestScore = score;
      }
    }
    return bestScore >= 180 ? best : null;
  }

  async function locateScannedPost(target = {}) {
    // Thử ngay trên DOM đang có trước: nhanh nhất, không cuộn.
    let found = findBestVisiblePost(target);
    if (found?.element) {
      found.element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      await sleep(260);
      flashLocatedPost(found.element);
      return { found: true, method: 'visible' };
    }

    const scrollElement = document.scrollingElement || document.documentElement || document.body;
    const startTop = scrollElement.scrollTop;
    const viewport = Math.max(window.innerHeight || 760, 600);
    const maxSteps = 22;

    // Pending posts dùng virtual DOM. Quét nhanh từ đầu xuống bằng bước lớn và dừng ngay khi thấy bài.
    scrollElement.scrollTo({ top: 0, behavior: 'instant' });
    await sleep(180);
    for (let step = 0; step < maxSteps; step += 1) {
      found = findBestVisiblePost(target);
      if (found?.element) {
        found.element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        await sleep(260);
        flashLocatedPost(found.element);
        return { found: true, method: 'scroll', steps: step + 1 };
      }

      const before = scrollElement.scrollTop;
      const maxTop = Math.max(0, scrollElement.scrollHeight - viewport);
      if (before >= maxTop - 80) break;
      scrollElement.scrollTo({ top: Math.min(maxTop, before + Math.floor(viewport * 1.15)), behavior: 'instant' });
      await sleep(170);
    }

    // Không tìm thấy thì trả người dùng về vị trí cũ.
    scrollElement.scrollTo({ top: startTop, behavior: 'instant' });
    return { found: false };
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'cancelApproveTask') {
      cancelCurrentTask();
      sendResponse({ ok: true });
      return false;
    }
    if (message.action === 'scan') {
      scanPendingPosts().then((result) => sendResponse(result)).catch((error) => sendResponse({ error: error.message || String(error) }));
      return true;
    }
    if (message.action === 'executeScannedPlan') {
      executeScannedModerationPlan(message.plan || []).then((result) => sendResponse({ results: result })).catch((error) => sendResponse({ error: error.message || String(error) }));
      return true;
    }
    // Giữ endpoint cũ để tương thích, nhưng UI 1.42.20 không còn gọi nó.
    if (message.action === 'runAutoMod') {
      runAutoModeration().then((result) => sendResponse({ results: result })).catch((error) => sendResponse({ error: error.message || String(error) }));
      return true;
    }
    if (message.action === 'locateScannedPost') {
      locateScannedPost(message).then((result) => sendResponse(result)).catch((error) => sendResponse({ found: false, error: error.message || String(error) }));
      return true;
    }
    return false;
  });

  window.fbGroupAutoMod = {
    version: FB_GROUP_AUTO_MOD_VERSION,
    scanPendingPosts,
    runAutoModeration,
    executeScannedModerationPlan,
    locateScannedPost,
    cancelCurrentTask,
  };
}
