import { validateSchedule } from './logic.mjs';

const examples = [
  ['Bao Bì Xanh', 'Bao bì carton bền vững', 'Chủ cửa hàng chú trọng môi trường', 'Thực tế và có dẫn chứng', 'Khám phá giải pháp phù hợp'],
  ['Carton Lab', 'Kỹ thuật sản xuất carton', 'Nhà mua hàng kỹ thuật', 'Phân tích các thông số', 'Trao đổi yêu cầu kỹ thuật'],
  ['Hộp Đẹp', 'Thiết kế bao bì carton', 'Nhà thiết kế và nhãn hàng', 'Giàu cảm hứng và trực quan', 'Chia sẻ ý tưởng của bạn'],
  ['Đóng Gói Thông Minh', 'Mẹo đóng gói sản phẩm', 'Shop online', 'Ngắn gọn, dễ thực hành', 'Lưu lại mẹo hữu ích'],
  ['In Ấn 360', 'Công nghệ in bao bì', 'Nhân sự sản xuất in', 'Chuyên nghiệp, rõ bước', 'Trao đổi vấn đề bạn gặp'],
  ['Kinh Doanh Bao Bì', 'Tối ưu đơn hàng bao bì', 'Doanh nghiệp vừa và nhỏ', 'Tư vấn chi phí, không quảng cáo quá mức', 'Tìm hiểu lựa chọn'],
  ['Góc Thiết Kế', 'Sáng tạo và nhận diện thương hiệu qua bao bì', 'Người làm thương hiệu', 'Phân tích tình huống dễ hiểu', 'Bạn ưu tiên yếu tố nào?'],
  ['Cà Phê Mỗi Ngày', 'Cà phê và đồ uống', 'Khách hàng yêu cà phê', 'Ấm áp, thân thiện', 'Ghé quán khi có dịp'],
  ['Nhà Gọn Mỗi Ngày', 'Bài trí và tổ chức nhà cửa', 'Người yêu nội thất', 'Tối giản và hữu ích', 'Bạn có mẹo nào khác?'],
  ['Tech Brief', 'Công nghệ và năng suất', 'Người làm việc số', 'Trung lập, giải thích dễ hiểu', 'Theo dõi để cập nhật']
];

const topicSets = [
  {
    title: 'Chọn loại thùng carton phù hợp cho hàng dễ vỡ',
    brief: 'So sánh tiêu chí độ cứng, kích thước và lớp đệm. Không tự gán thông số kỹ thuật.',
    page_ids: ['page-1','page-2','page-3','page-4','page-5','page-6','page-7'],
    angle: 'Khi chọn thùng cho hàng dễ vỡ, cần cân nhắc độ cứng, không gian chèn đệm và cách vận chuyển.',
    stages: ['scheduled','approved','draft','scheduled','approved','draft','draft']
  },
  {
    title: 'Ba câu hỏi nên hỏi trước khi đặt in hộp giấy',
    brief: 'Xác định mục đích sử dụng, số lượng và tiêu chuẩn màu. Không đưa báo giá giả.',
    page_ids: ['page-1','page-3','page-5','page-6'],
    angle: 'Trước khi đặt in, hãy làm rõ số lượng, màu sắc và mục đích sử dụng của chiếc hộp.',
    stages: ['approved','draft','draft','scheduled']
  },
  {
    title: 'Gợi ý đồ uống mùa mưa',
    brief: 'Phân nhóm đồ uống nóng và lạnh theo trải nghiệm người uống.',
    page_ids: ['page-8'], angle: 'Một ngày mưa có thể phù hợp với ly đồ uống ấm, thơm và dễ thưởng thức.',
    stages: ['approved']
  },
  {
    title: 'Sắp xếp góc làm việc trong 15 phút',
    brief: 'Tập trung vào ánh sáng, dây sạc và vật dụng cần thiết; không hứa tăng năng suất.',
    page_ids: ['page-9'], angle: 'Một góc làm việc gọn gàng bắt đầu từ việc giữ lại các vật dụng thực sự cần.',
    stages: ['draft']
  },
  {
    title: 'AI có giúp viết bản nháp nhanh hơn không?',
    brief: 'Nhấn mạnh kiểm tra thông tin và bước duyệt của con người.',
    page_ids: ['page-10'], angle: 'AI hỗ trợ bản nháp; người biên tập vẫn cần chịu trách nhiệm về độ chính xác.',
    stages: ['scheduled']
  }
];

export function seedDemo(store, log = () => {}) {
  if (store.one('SELECT count(*) AS n FROM ideas').n > 0) return { seeded: false };
  examples.forEach(([name,topic,audience,voice,cta],i) => {
    store.updatePage('page-'+(i+1),{name,topic,audience,voice,cta,meta_page_id:''});
  });
  let variants = 0, scheduled = 0;
  const base = Date.now();
  topicSets.forEach((idea,i) => {
    const id = store.createIdea(idea);
    const items = store.q('SELECT id,page_id FROM variants WHERE idea_id=? ORDER BY page_id',id);
    items.forEach((v,j) => {
      const p = store.one('SELECT * FROM pages WHERE id=?',v.page_id);
      const body = p.name + ': ' + idea.angle + '\n\n' + idea.brief +
        (p.cta ? '\n\n' + p.cta + '.' : '');
      store.updateVariant(v.id,body,1);
      const stage=idea.stages[j] || 'draft';
      if (stage !== 'draft') store.approve(v.id,2);
      if (stage === 'scheduled') {
        const schedule=validateSchedule(new Date(base + (i+1)*86400_000 + j*3600_000).toISOString(),base);
        const { deliveryId }=store.reserve(v.id,schedule,'mock',2);
        store.finish(deliveryId,'scheduled','demo-mock-'+(i+1)+'-'+(j+1));
        scheduled++;
      }
      variants++;
    });
  });
  log('Demo data loaded: 10 Pages, '+topicSets.length+' ideas, '+variants+' variants, '+scheduled+' mock schedules');
  return { seeded: true, pages: 10, ideas:topicSets.length, variants, scheduled };
}
