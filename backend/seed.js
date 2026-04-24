require('dotenv').config({ path: '../.env' });
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

async function seed() {
  try {
    console.log('Creating tables...');

    // Create tables
    await pool.query(`
      DROP TABLE IF EXISTS ai_generations CASCADE;
      DROP TABLE IF EXISTS transcripts CASCADE;
      DROP TABLE IF EXISTS music_matches CASCADE;
      DROP TABLE IF EXISTS broll_suggestions CASCADE;
      DROP TABLE IF EXISTS highlights CASCADE;
      DROP TABLE IF EXISTS sports_highlights CASCADE;
      DROP TABLE IF EXISTS interview_questions CASCADE;
      DROP TABLE IF EXISTS videos CASCADE;
      DROP TABLE IF EXISTS scripts CASCADE;
      DROP TABLE IF EXISTS voiceovers CASCADE;
      DROP TABLE IF EXISTS templates CASCADE;
      DROP TABLE IF EXISTS avatars CASCADE;
      DROP TABLE IF EXISTS reviews CASCADE;
      DROP TABLE IF EXISTS users CASCADE;

      CREATE TABLE users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        name VARCHAR(255),
        role VARCHAR(50) DEFAULT 'editor',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE password_reset_tokens (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        token VARCHAR(255) UNIQUE NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        used BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE reviews (
        id SERIAL PRIMARY KEY,
        customer_name VARCHAR(255) NOT NULL,
        customer_email VARCHAR(255),
        company VARCHAR(255),
        rating INTEGER CHECK (rating >= 1 AND rating <= 5),
        review_text TEXT NOT NULL,
        source VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE avatars (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        provider VARCHAR(100) NOT NULL,
        avatar_id VARCHAR(255),
        gender VARCHAR(50),
        style VARCHAR(100),
        thumbnail_url TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE templates (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        duration INTEGER,
        background_color VARCHAR(50),
        font_style VARCHAR(100),
        animation_type VARCHAR(100),
        category VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE scripts (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        content TEXT NOT NULL,
        tone VARCHAR(100),
        word_count INTEGER,
        review_id INTEGER REFERENCES reviews(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE voiceovers (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        voice_id VARCHAR(255),
        provider VARCHAR(100),
        language VARCHAR(100),
        gender VARCHAR(50),
        accent VARCHAR(100),
        sample_url TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE videos (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        review_id INTEGER REFERENCES reviews(id) ON DELETE SET NULL,
        avatar_id INTEGER REFERENCES avatars(id) ON DELETE SET NULL,
        template_id INTEGER REFERENCES templates(id) ON DELETE SET NULL,
        status VARCHAR(50) DEFAULT 'pending',
        video_url TEXT,
        duration INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      -- New tables for additional features

      CREATE TABLE interview_questions (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        topic VARCHAR(255),
        difficulty VARCHAR(50),
        question_type VARCHAR(100),
        questions JSONB,
        context TEXT,
        industry VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE sports_highlights (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        sport_type VARCHAR(100),
        event_name VARCHAR(255),
        team_name VARCHAR(255),
        player_name VARCHAR(255),
        highlight_type VARCHAR(100),
        start_time VARCHAR(50),
        end_time VARCHAR(50),
        duration INTEGER,
        description TEXT,
        tags JSONB,
        video_url TEXT,
        thumbnail_url TEXT,
        ai_analysis JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE highlights (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        source_type VARCHAR(100),
        content_type VARCHAR(100),
        start_time VARCHAR(50),
        end_time VARCHAR(50),
        duration INTEGER,
        description TEXT,
        importance_score INTEGER,
        keywords JSONB,
        transcript_snippet TEXT,
        video_url TEXT,
        thumbnail_url TEXT,
        ai_analysis JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE broll_suggestions (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        context TEXT,
        industry VARCHAR(100),
        mood VARCHAR(100),
        keywords JSONB,
        suggestions JSONB,
        stock_sources JSONB,
        style_notes TEXT,
        color_palette JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE music_matches (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        content_type VARCHAR(100),
        mood VARCHAR(100),
        genre VARCHAR(100),
        tempo VARCHAR(50),
        energy_level VARCHAR(50),
        duration INTEGER,
        suggestions JSONB,
        licensing_info TEXT,
        style_notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE transcripts (
        id SERIAL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        source_type VARCHAR(100),
        language VARCHAR(50),
        duration INTEGER,
        content TEXT,
        timestamps JSONB,
        speakers JSONB,
        keywords JSONB,
        summary TEXT,
        confidence_score DECIMAL(5,2),
        video_url TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE ai_generations (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        tool_id VARCHAR(100) NOT NULL,
        tool_name VARCHAR(255) NOT NULL,
        input_data JSONB,
        input_summary TEXT,
        output_data JSONB,
        output_summary TEXT,
        model VARCHAR(255),
        total_tokens INTEGER,
        generated_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    console.log('Tables created successfully!');

    // Seed Users
    console.log('Seeding users...');
    const hashedPassword = await bcrypt.hash('password123', 10);
    await pool.query(`
      INSERT INTO users (email, password_hash, name, role) VALUES
      ('demo@example.com', '${hashedPassword}', 'Demo User', 'editor'),
      ('admin@example.com', '${hashedPassword}', 'Admin User', 'admin'),
      ('viewer@example.com', '${hashedPassword}', 'Viewer User', 'viewer')
    `);

    // Seed Reviews (16 items)
    console.log('Seeding reviews...');
    await pool.query(`
      INSERT INTO reviews (customer_name, customer_email, company, rating, review_text, source) VALUES
      ('Sarah Johnson', 'sarah@techcorp.com', 'TechCorp Solutions', 5, 'This product completely transformed our workflow! We saw a 40% increase in productivity within the first month. The customer support team was incredibly helpful during onboarding. Highly recommend to any growing business!', 'Google Reviews'),
      ('Michael Chen', 'mchen@innovate.io', 'Innovate Labs', 5, 'After trying multiple solutions, we finally found one that works. The interface is intuitive, the features are robust, and the price is fair. Our team adopted it immediately without any training needed.', 'Trustpilot'),
      ('Emily Rodriguez', 'emily@startupxyz.com', 'StartupXYZ', 4, 'Great platform with excellent features. The AI capabilities are impressive and have saved us countless hours. Minor learning curve at first, but the documentation is comprehensive.', 'G2 Crowd'),
      ('David Thompson', 'david@enterprise.net', 'Enterprise Holdings', 5, 'We have been using this for 6 months now and the ROI has been phenomenal. Customer success team goes above and beyond. This is now an essential part of our tech stack.', 'Capterra'),
      ('Jessica Williams', 'jwilliams@creative.co', 'Creative Agency Co', 5, 'As a creative agency, we need tools that keep up with our fast pace. This solution delivers every time. The collaboration features are game-changing for our distributed team.', 'LinkedIn'),
      ('Robert Kim', 'rkim@finance.plus', 'Finance Plus', 4, 'Security was our main concern, and this platform exceeded our expectations. Bank-level encryption, compliance features, and audit trails. Perfect for financial services.', 'Software Advice'),
      ('Amanda Foster', 'afoster@retail.hub', 'Retail Hub', 5, 'Implemented this across all our stores and saw immediate results. Inventory management is now seamless, and our staff loves how easy it is to use. Customer complaints dropped by 60%!', 'Google Reviews'),
      ('James Wilson', 'james@logistics.pro', 'LogisticsPro', 5, 'Route optimization alone saved us $50K in the first quarter. The real-time tracking gives our clients peace of mind, and dispatching is now fully automated. Best investment we made.', 'Trustpilot'),
      ('Maria Garcia', 'maria@health.care', 'HealthCare United', 4, 'HIPAA compliance was crucial for us, and this platform delivers. Patient scheduling, records management, and billing all in one place. Our administrative workload dropped significantly.', 'G2 Crowd'),
      ('Christopher Lee', 'clee@education.org', 'EduTech Academy', 5, 'Transformed how we deliver online courses. Student engagement increased by 75%, and our instructors find the content creation tools incredibly powerful. The analytics help us improve constantly.', 'Capterra'),
      ('Nicole Brown', 'nicole@marketing.io', 'Marketing Dynamics', 5, 'The campaign automation features are outstanding. We run 10x more campaigns with the same team size. The AI-powered insights help us make data-driven decisions quickly.', 'Product Hunt'),
      ('Thomas Anderson', 'tanderson@manufacturing.com', 'Anderson Manufacturing', 4, 'Streamlined our entire production pipeline. Quality control improved, waste reduced, and we can now track every component in real-time. The initial setup was complex but worth it.', 'Software Advice'),
      ('Lisa Martinez', 'lisa@nonprofit.org', 'Community First Foundation', 5, 'As a nonprofit, budget is always a concern. This platform offers incredible value with special nonprofit pricing. Donor management and event planning have never been easier.', 'Google Reviews'),
      ('Kevin O Brien', 'kobrien@construction.co', 'O Brien Construction', 5, 'Project management in construction is chaotic, but this tool brought order to our operations. Subcontractor coordination, timeline tracking, and budget management all improved dramatically.', 'Trustpilot'),
      ('Rachel Green', 'rgreen@hospitality.com', 'Green Hotels Group', 5, 'Guest satisfaction scores went up 30% after implementing this system. Booking management, housekeeping coordination, and guest communication are now seamless. Our staff is happier too!', 'G2 Crowd'),
      ('Daniel Park', 'dpark@automotive.net', 'Park Auto Group', 4, 'Service scheduling and customer follow-ups are now automated. We converted 25% more service leads into appointments. The integration with our existing systems was smooth.', 'Capterra')
    `);

    // Seed Avatars (16 items)
    console.log('Seeding avatars...');
    await pool.query(`
      INSERT INTO avatars (name, provider, avatar_id, gender, style, thumbnail_url) VALUES
      ('Professional Sarah', 'HeyGen', 'hg_sarah_001', 'Female', 'Business Professional', 'https://via.placeholder.com/150?text=Sarah'),
      ('Executive Michael', 'HeyGen', 'hg_michael_002', 'Male', 'Corporate Executive', 'https://via.placeholder.com/150?text=Michael'),
      ('Casual Emma', 'D-ID', 'did_emma_001', 'Female', 'Casual Friendly', 'https://via.placeholder.com/150?text=Emma'),
      ('Tech Expert James', 'D-ID', 'did_james_002', 'Male', 'Tech Industry', 'https://via.placeholder.com/150?text=James'),
      ('Healthcare Lisa', 'Synthesia', 'syn_lisa_001', 'Female', 'Healthcare Professional', 'https://via.placeholder.com/150?text=Lisa'),
      ('Finance Director Robert', 'Synthesia', 'syn_robert_002', 'Male', 'Finance Professional', 'https://via.placeholder.com/150?text=Robert'),
      ('Creative Director Alex', 'HeyGen', 'hg_alex_003', 'Non-binary', 'Creative Industry', 'https://via.placeholder.com/150?text=Alex'),
      ('Startup Founder Maya', 'HeyGen', 'hg_maya_004', 'Female', 'Startup Casual', 'https://via.placeholder.com/150?text=Maya'),
      ('Sales Expert Chris', 'D-ID', 'did_chris_003', 'Male', 'Sales Professional', 'https://via.placeholder.com/150?text=Chris'),
      ('HR Specialist Patricia', 'D-ID', 'did_patricia_004', 'Female', 'Human Resources', 'https://via.placeholder.com/150?text=Patricia'),
      ('Legal Advisor Marcus', 'Synthesia', 'syn_marcus_003', 'Male', 'Legal Professional', 'https://via.placeholder.com/150?text=Marcus'),
      ('Education Expert Nina', 'Synthesia', 'syn_nina_004', 'Female', 'Education Sector', 'https://via.placeholder.com/150?text=Nina'),
      ('Retail Manager Tom', 'HeyGen', 'hg_tom_005', 'Male', 'Retail Industry', 'https://via.placeholder.com/150?text=Tom'),
      ('Hospitality Host Sofia', 'HeyGen', 'hg_sofia_006', 'Female', 'Hospitality Industry', 'https://via.placeholder.com/150?text=Sofia'),
      ('Manufacturing Lead John', 'D-ID', 'did_john_005', 'Male', 'Manufacturing', 'https://via.placeholder.com/150?text=John'),
      ('Nonprofit Director Grace', 'Synthesia', 'syn_grace_005', 'Female', 'Nonprofit Sector', 'https://via.placeholder.com/150?text=Grace')
    `);

    // Seed Templates (16 items)
    console.log('Seeding templates...');
    await pool.query(`
      INSERT INTO templates (name, description, duration, background_color, font_style, animation_type, category) VALUES
      ('Corporate Classic', 'Clean, professional template for B2B testimonials', 60, '#1a365d', 'Inter', 'Fade', 'Corporate'),
      ('Modern Minimal', 'Sleek minimalist design with plenty of white space', 45, '#ffffff', 'Poppins', 'Slide', 'Modern'),
      ('Tech Startup', 'Dynamic template with gradient backgrounds', 30, '#667eea', 'Space Grotesk', 'Zoom', 'Technology'),
      ('Healthcare Trust', 'Calming colors and professional feel', 60, '#2c7a7b', 'Nunito', 'Fade', 'Healthcare'),
      ('Finance Secure', 'Traditional and trustworthy appearance', 45, '#2d3748', 'Merriweather', 'Slide', 'Finance'),
      ('Creative Bold', 'Vibrant colors and dynamic animations', 30, '#ed64a6', 'Montserrat', 'Bounce', 'Creative'),
      ('Education Friendly', 'Warm and approachable for edu sector', 60, '#f6ad55', 'Quicksand', 'Fade', 'Education'),
      ('Retail Energy', 'Energetic template for consumer brands', 30, '#e53e3e', 'Raleway', 'Pop', 'Retail'),
      ('Hospitality Warm', 'Inviting design for service industries', 45, '#d69e2e', 'Playfair Display', 'Fade', 'Hospitality'),
      ('Manufacturing Pro', 'Industrial and professional look', 60, '#4a5568', 'Roboto', 'Slide', 'Manufacturing'),
      ('Nonprofit Heart', 'Emotional and mission-driven template', 45, '#48bb78', 'Lora', 'Fade', 'Nonprofit'),
      ('SaaS Product', 'Perfect for software product testimonials', 30, '#5a67d8', 'IBM Plex Sans', 'Zoom', 'Technology'),
      ('Real Estate Luxury', 'Elegant template for premium services', 60, '#744210', 'Cormorant Garamond', 'Fade', 'Real Estate'),
      ('Fitness Dynamic', 'High-energy template for health brands', 30, '#dd6b20', 'Oswald', 'Bounce', 'Fitness'),
      ('Legal Professional', 'Dignified and trustworthy appearance', 45, '#1a202c', 'Libre Baskerville', 'Fade', 'Legal'),
      ('E-commerce Conversion', 'Optimized for product testimonials', 30, '#319795', 'DM Sans', 'Pop', 'E-commerce')
    `);

    // Seed Scripts (16 items)
    console.log('Seeding scripts...');
    await pool.query(`
      INSERT INTO scripts (title, content, tone, word_count, review_id) VALUES
      ('TechCorp Success Story', 'Hi, I am Sarah from TechCorp Solutions. When we first heard about this product, I was skeptical. But within just one month of implementing it, our team productivity skyrocketed by 40 percent. The onboarding was seamless, and whenever we had questions, customer support was right there to help. If you are a growing business looking to scale, this is the tool you need.', 'Professional', 72, 1),
      ('Innovate Labs Journey', 'After testing what felt like every solution on the market, we finally found the one. I am Michael from Innovate Labs, and I can honestly say the interface is so intuitive that our team started using it right away, no training required. The features are exactly what we needed, and the pricing is fair. It just works.', 'Enthusiastic', 65, 2),
      ('StartupXYZ Experience', 'Hey there, Emily here from StartupXYZ. Look, I will be honest, there was a small learning curve at first. But the AI capabilities? Absolutely impressive. We have saved countless hours on tasks that used to eat up our whole day. The documentation helped us get up to speed quickly. Definitely worth checking out.', 'Casual', 58, 3),
      ('Enterprise Success', 'David Thompson, Enterprise Holdings. Six months with this platform and I can tell you, the ROI speaks for itself. What really sets them apart is their customer success team. They genuinely go above and beyond. This has become an essential part of our tech stack.', 'Corporate', 52, 4),
      ('Creative Agency Story', 'At Creative Agency Co, we move fast. We need tools that can keep up with our pace. This solution delivers. Every. Single. Time. The collaboration features have been game-changing for our distributed team. I am Jessica, and I cannot imagine going back to how we worked before.', 'Dynamic', 55, 5),
      ('Finance Security Focus', 'Security was our number one concern at Finance Plus. I am Robert, and I can say this platform exceeded every expectation. Bank-level encryption, full compliance features, complete audit trails. If you are in financial services, this is built for you.', 'Formal', 48, 6),
      ('Retail Transformation', 'Amanda from Retail Hub here. We rolled this out across all our stores and the results were immediate. Inventory management is smooth, staff adoption was instant because it is so easy to use. Our customer complaints dropped by sixty percent. That number alone tells you everything.', 'Energetic', 55, 7),
      ('Logistics Efficiency', 'I am James from LogisticsPro. Route optimization alone saved us fifty thousand dollars in Q1. Fifty thousand. Real-time tracking gives our clients confidence, and dispatching is now fully automated. Best investment this company has ever made.', 'Direct', 48, 8),
      ('Healthcare Compliance', 'Maria Garcia, HealthCare United. HIPAA compliance was non-negotiable for us. This platform delivers that and so much more. Patient scheduling, records, billing, all in one place. Our admin workload dropped significantly. The peace of mind is priceless.', 'Professional', 52, 9),
      ('Education Innovation', 'Christopher here from EduTech Academy. This platform transformed online education for us. Student engagement up seventy-five percent. Our instructors love the content creation tools. The analytics help us improve constantly. Education will never be the same.', 'Inspiring', 45, 10),
      ('Marketing Automation', 'Nicole from Marketing Dynamics. We now run ten times more campaigns with the exact same team. The AI-powered insights are incredible. Data-driven decisions that used to take weeks now happen in minutes. This is the future of marketing.', 'Confident', 42, 11),
      ('Manufacturing Excellence', 'Thomas Anderson, Anderson Manufacturing. Our entire production pipeline is streamlined now. Quality control improved, waste reduced, real-time component tracking. Setup was detailed but absolutely worth the investment.', 'Technical', 38, 12),
      ('Nonprofit Impact', 'Lisa from Community First Foundation. As a nonprofit, every dollar matters. This platform offers incredible value with special pricing for organizations like ours. Donor management and events have never been easier to coordinate.', 'Heartfelt', 40, 13),
      ('Construction Management', 'Kevin O Brien, O Brien Construction. Construction is chaos. Was chaos. This tool brought order. Subcontractor coordination, timelines, budgets. All dramatically improved. Our project success rate is higher than ever.', 'Straightforward', 35, 14),
      ('Hospitality Excellence', 'Rachel Green, Green Hotels Group. Guest satisfaction scores increased thirty percent. Booking, housekeeping, guest communication, it is all seamless now. Our staff is happier, our guests are happier. Win-win.', 'Warm', 38, 15),
      ('Automotive Success', 'Daniel Park from Park Auto Group. Service scheduling and follow-ups on autopilot. Twenty-five percent more service appointments from the same leads. Integration was smooth. The numbers do not lie.', 'Results-focused', 35, 16)
    `);

    // Seed Voiceovers (16 items)
    console.log('Seeding voiceovers...');
    await pool.query(`
      INSERT INTO voiceovers (name, voice_id, provider, language, gender, accent, sample_url) VALUES
      ('Emma Professional', 'emma_pro_001', 'ElevenLabs', 'English', 'Female', 'American', 'https://example.com/samples/emma.mp3'),
      ('James Corporate', 'james_corp_002', 'ElevenLabs', 'English', 'Male', 'American', 'https://example.com/samples/james.mp3'),
      ('Sophie British', 'sophie_uk_001', 'Amazon Polly', 'English', 'Female', 'British', 'https://example.com/samples/sophie.mp3'),
      ('Oliver London', 'oliver_uk_002', 'Amazon Polly', 'English', 'Male', 'British', 'https://example.com/samples/oliver.mp3'),
      ('Maria Spanish', 'maria_es_001', 'Google TTS', 'Spanish', 'Female', 'Castilian', 'https://example.com/samples/maria.mp3'),
      ('Carlos Mexican', 'carlos_mx_001', 'Google TTS', 'Spanish', 'Male', 'Mexican', 'https://example.com/samples/carlos.mp3'),
      ('Amelie French', 'amelie_fr_001', 'ElevenLabs', 'French', 'Female', 'Parisian', 'https://example.com/samples/amelie.mp3'),
      ('Pierre Quebec', 'pierre_qc_001', 'Amazon Polly', 'French', 'Male', 'Quebec', 'https://example.com/samples/pierre.mp3'),
      ('Hans German', 'hans_de_001', 'Google TTS', 'German', 'Male', 'Standard', 'https://example.com/samples/hans.mp3'),
      ('Greta German', 'greta_de_002', 'ElevenLabs', 'German', 'Female', 'Standard', 'https://example.com/samples/greta.mp3'),
      ('Yuki Japanese', 'yuki_jp_001', 'Amazon Polly', 'Japanese', 'Female', 'Tokyo', 'https://example.com/samples/yuki.mp3'),
      ('Kenji Japanese', 'kenji_jp_002', 'Google TTS', 'Japanese', 'Male', 'Tokyo', 'https://example.com/samples/kenji.mp3'),
      ('Wei Mandarin', 'wei_cn_001', 'ElevenLabs', 'Mandarin', 'Male', 'Beijing', 'https://example.com/samples/wei.mp3'),
      ('Mei Mandarin', 'mei_cn_002', 'Amazon Polly', 'Mandarin', 'Female', 'Beijing', 'https://example.com/samples/mei.mp3'),
      ('Raj Hindi', 'raj_in_001', 'Google TTS', 'Hindi', 'Male', 'Indian', 'https://example.com/samples/raj.mp3'),
      ('Priya Hindi', 'priya_in_002', 'ElevenLabs', 'Hindi', 'Female', 'Indian', 'https://example.com/samples/priya.mp3')
    `);

    // Seed Videos (16 items)
    console.log('Seeding videos...');
    await pool.query(`
      INSERT INTO videos (title, review_id, avatar_id, template_id, status, video_url, duration) VALUES
      ('TechCorp 40% Productivity Boost', 1, 1, 1, 'completed', 'https://example.com/videos/techcorp.mp4', 60),
      ('Innovate Labs Found The One', 2, 2, 2, 'completed', 'https://example.com/videos/innovate.mp4', 45),
      ('StartupXYZ AI Revolution', 3, 3, 3, 'completed', 'https://example.com/videos/startup.mp4', 30),
      ('Enterprise Holdings ROI Story', 4, 4, 1, 'completed', 'https://example.com/videos/enterprise.mp4', 60),
      ('Creative Agency Transformation', 5, 5, 6, 'rendering', 'https://example.com/videos/creative.mp4', 45),
      ('Finance Plus Security First', 6, 6, 5, 'completed', 'https://example.com/videos/finance.mp4', 45),
      ('Retail Hub 60% Less Complaints', 7, 7, 8, 'completed', 'https://example.com/videos/retail.mp4', 30),
      ('LogisticsPro $50K Savings', 8, 8, 10, 'completed', 'https://example.com/videos/logistics.mp4', 60),
      ('HealthCare United HIPAA Ready', 9, 9, 4, 'rendering', 'https://example.com/videos/healthcare.mp4', 60),
      ('EduTech 75% Engagement', 10, 10, 7, 'completed', 'https://example.com/videos/edutech.mp4', 60),
      ('Marketing Dynamics 10X Campaigns', 11, 11, 3, 'completed', 'https://example.com/videos/marketing.mp4', 30),
      ('Anderson Manufacturing Pipeline', 12, 12, 10, 'pending', NULL, 60),
      ('Community First Mission', 13, 13, 11, 'completed', 'https://example.com/videos/community.mp4', 45),
      ('O Brien Construction Order', 14, 14, 10, 'rendering', NULL, 45),
      ('Green Hotels Guest Joy', 15, 15, 9, 'completed', 'https://example.com/videos/hotels.mp4', 45),
      ('Park Auto 25% More Leads', 16, 16, 1, 'pending', NULL, 30)
    `);

    // Seed Interview Questions (16 items)
    console.log('Seeding interview questions...');
    await pool.query(`
      INSERT INTO interview_questions (title, topic, difficulty, question_type, questions, context, industry) VALUES
      ('Customer Success Interview', 'Customer Experience', 'Medium', 'Behavioral', '${JSON.stringify(["What was your first impression of our product?", "How has our solution impacted your daily workflow?", "What specific features do you use most often?", "Can you describe a challenge we helped you overcome?", "Would you recommend us to a colleague? Why?"])}', 'For gathering authentic customer testimonials', 'Technology'),
      ('Product Feedback Session', 'Product Development', 'Easy', 'Open-ended', '${JSON.stringify(["What made you choose our product over competitors?", "What is your favorite feature and why?", "If you could add one feature, what would it be?", "How would you describe our product to a friend?", "What surprised you most about using our solution?"])}', 'Understanding product perception and improvement areas', 'SaaS'),
      ('Leadership Testimonial', 'Executive Experience', 'Hard', 'Strategic', '${JSON.stringify(["How has this solution impacted your company KPIs?", "What ROI have you seen since implementation?", "How did the onboarding process meet executive expectations?", "What strategic value does this bring to your organization?", "How does this compare to previous solutions you have used?"])}', 'For C-suite and executive testimonials', 'Enterprise'),
      ('User Onboarding Feedback', 'Onboarding Experience', 'Easy', 'Experience', '${JSON.stringify(["How easy was it to get started with our product?", "What resources helped you learn the platform?", "Was the documentation clear and helpful?", "How long did it take to feel comfortable using the tool?", "What could we improve about the onboarding process?"])}', 'Improving user onboarding experience', 'Software'),
      ('Support Experience Review', 'Customer Support', 'Medium', 'Service', '${JSON.stringify(["How would you rate your support experience?", "Can you describe a time our support team helped you?", "How quickly were your issues resolved?", "What stands out about our customer service?", "How does our support compare to other companies?"])}', 'Evaluating customer support quality', 'Service'),
      ('Healthcare Provider Interview', 'Healthcare Solutions', 'Hard', 'Compliance', '${JSON.stringify(["How does our solution meet HIPAA requirements?", "What patient care improvements have you seen?", "How has this affected your administrative workload?", "What security features are most valuable to you?", "Would you recommend this to other healthcare providers?"])}', 'Healthcare-specific testimonials', 'Healthcare'),
      ('Financial Services Feedback', 'Finance Technology', 'Hard', 'Security', '${JSON.stringify(["How does our security meet your compliance needs?", "What efficiency gains have you experienced?", "How has this affected your client relationships?", "What audit features do you find most valuable?", "How does our platform handle sensitive financial data?"])}', 'Financial industry testimonials', 'Finance'),
      ('E-commerce Success Story', 'Online Retail', 'Medium', 'Growth', '${JSON.stringify(["How has this platform affected your sales?", "What features drive the most conversions?", "How has customer satisfaction changed?", "What integration capabilities do you value most?", "How does this compare to your previous e-commerce solution?"])}', 'E-commerce growth testimonials', 'Retail'),
      ('Education Platform Review', 'EdTech Solutions', 'Medium', 'Engagement', '${JSON.stringify(["How has student engagement changed since adoption?", "What learning outcomes have improved?", "How do instructors feel about the content creation tools?", "What analytics have been most valuable?", "How has this affected course completion rates?"])}', 'Educational institution testimonials', 'Education'),
      ('Marketing ROI Interview', 'Marketing Technology', 'Medium', 'Results', '${JSON.stringify(["What marketing metrics have improved most?", "How has campaign efficiency changed?", "What automation features save you the most time?", "How has lead quality improved?", "What ROI have you seen from the platform?"])}', 'Marketing success stories', 'Marketing'),
      ('Manufacturing Efficiency Study', 'Production Optimization', 'Hard', 'Operational', '${JSON.stringify(["How has production efficiency improved?", "What quality control improvements have you seen?", "How has waste reduction been achieved?", "What real-time tracking features are most valuable?", "How has this affected your supply chain?"])}', 'Manufacturing industry testimonials', 'Manufacturing'),
      ('Nonprofit Impact Interview', 'Social Impact', 'Easy', 'Mission', '${JSON.stringify(["How has this helped your nonprofit mission?", "What donor management improvements have you seen?", "How has volunteer coordination changed?", "What value does the nonprofit pricing provide?", "How has this affected your community impact?"])}', 'Nonprofit organization testimonials', 'Nonprofit'),
      ('Startup Growth Interview', 'Startup Scaling', 'Medium', 'Growth', '${JSON.stringify(["How has this solution helped you scale?", "What features are most critical for a startup?", "How does the pricing fit your growth stage?", "What time savings have you experienced?", "How has this affected your ability to compete?"])}', 'Startup success testimonials', 'Startup'),
      ('Remote Work Solutions', 'Distributed Teams', 'Medium', 'Collaboration', '${JSON.stringify(["How has this improved remote team collaboration?", "What communication features are most valuable?", "How has productivity changed for distributed teams?", "What integrations do you use most often?", "How does this compare to other remote work tools?"])}', 'Remote work success stories', 'Technology'),
      ('Customer Loyalty Interview', 'Retention Strategy', 'Easy', 'Loyalty', '${JSON.stringify(["How long have you been using our product?", "What keeps you coming back?", "Have you explored competitor options?", "Would you expand your usage of our platform?", "What would you tell someone considering switching away?"])}', 'Long-term customer testimonials', 'General'),
      ('Integration Success Story', 'Technical Implementation', 'Hard', 'Technical', '${JSON.stringify(["How smooth was the integration process?", "What systems did you integrate with?", "How has data flow improved between tools?", "What technical support was most helpful?", "What would you recommend for a smooth implementation?"])}', 'Technical integration testimonials', 'Enterprise')
    `);

    // Seed Sports Highlights (16 items)
    console.log('Seeding sports highlights...');
    await pool.query(`
      INSERT INTO sports_highlights (title, sport_type, event_name, team_name, player_name, highlight_type, start_time, end_time, duration, description, tags, video_url, thumbnail_url, ai_analysis) VALUES
      ('Championship Winning Goal', 'Soccer', 'Premier League Final', 'Manchester United', 'Marcus Rashford', 'Goal', '89:32', '90:15', 43, 'Stunning last-minute winner to clinch the title', '${JSON.stringify(["goal", "championship", "winning", "clutch"])}', 'https://example.com/highlights/goal1.mp4', 'https://example.com/thumbs/goal1.jpg', '${JSON.stringify({"excitement_level": 98, "key_moment": true, "virality_score": 95})}'),
      ('Game-Winning Three Pointer', 'Basketball', 'NBA Finals Game 7', 'Los Angeles Lakers', 'LeBron James', 'Shot', '00:03.2', '00:00', 8, 'Buzzer-beater from downtown to win the championship', '${JSON.stringify(["buzzer-beater", "three-pointer", "championship", "clutch"])}', 'https://example.com/highlights/shot1.mp4', 'https://example.com/thumbs/shot1.jpg', '${JSON.stringify({"excitement_level": 100, "key_moment": true, "virality_score": 99})}'),
      ('Record-Breaking Home Run', 'Baseball', 'World Series', 'New York Yankees', 'Aaron Judge', 'Home Run', '7th:2out', '7th:2out', 15, '500-foot grand slam to break the all-time record', '${JSON.stringify(["home-run", "grand-slam", "record", "historic"])}', 'https://example.com/highlights/hr1.mp4', 'https://example.com/thumbs/hr1.jpg', '${JSON.stringify({"excitement_level": 96, "key_moment": true, "virality_score": 92})}'),
      ('Incredible Touchdown Catch', 'Football', 'Super Bowl', 'Kansas City Chiefs', 'Travis Kelce', 'Touchdown', 'Q4:2:15', 'Q4:2:08', 12, 'One-handed catch in triple coverage for the go-ahead score', '${JSON.stringify(["touchdown", "one-handed", "catch", "super-bowl"])}', 'https://example.com/highlights/td1.mp4', 'https://example.com/thumbs/td1.jpg', '${JSON.stringify({"excitement_level": 94, "key_moment": true, "virality_score": 91})}'),
      ('Hat Trick Completion', 'Hockey', 'Stanley Cup Finals', 'Toronto Maple Leafs', 'Auston Matthews', 'Goal', '58:42', '59:01', 19, 'Third goal to complete the hat trick and seal the victory', '${JSON.stringify(["hat-trick", "goal", "stanley-cup", "historic"])}', 'https://example.com/highlights/hockey1.mp4', 'https://example.com/thumbs/hockey1.jpg', '${JSON.stringify({"excitement_level": 92, "key_moment": true, "virality_score": 88})}'),
      ('Match-Winning Ace', 'Tennis', 'Wimbledon Final', 'Individual', 'Carlos Alcaraz', 'Ace', 'Set5:6-5', 'Set5:7-5', 5, 'Championship-winning ace down the T', '${JSON.stringify(["ace", "championship", "wimbledon", "clutch"])}', 'https://example.com/highlights/tennis1.mp4', 'https://example.com/thumbs/tennis1.jpg', '${JSON.stringify({"excitement_level": 90, "key_moment": true, "virality_score": 85})}'),
      ('Photo Finish Sprint', 'Track & Field', 'Olympics 100m Final', 'USA', 'Noah Lyles', 'Race Finish', '9.78', '9.79', 12, 'Gold medal by 0.01 seconds in Olympic record time', '${JSON.stringify(["olympics", "100m", "gold-medal", "record"])}', 'https://example.com/highlights/sprint1.mp4', 'https://example.com/thumbs/sprint1.jpg', '${JSON.stringify({"excitement_level": 95, "key_moment": true, "virality_score": 93})}'),
      ('Knockout Punch', 'Boxing', 'Heavyweight Championship', 'Individual', 'Tyson Fury', 'Knockout', 'R11:2:45', 'R11:2:47', 8, 'Devastating right hook ends the fight', '${JSON.stringify(["knockout", "heavyweight", "championship", "dramatic"])}', 'https://example.com/highlights/boxing1.mp4', 'https://example.com/thumbs/boxing1.jpg', '${JSON.stringify({"excitement_level": 97, "key_moment": true, "virality_score": 94})}'),
      ('Birdie Putt to Win', 'Golf', 'The Masters', 'Individual', 'Scottie Scheffler', 'Putt', 'H18', 'H18', 10, '25-foot birdie putt to win the green jacket', '${JSON.stringify(["birdie", "masters", "putt", "championship"])}', 'https://example.com/highlights/golf1.mp4', 'https://example.com/thumbs/golf1.jpg', '${JSON.stringify({"excitement_level": 88, "key_moment": true, "virality_score": 82})}'),
      ('Bicycle Kick Goal', 'Soccer', 'Champions League', 'Real Madrid', 'Jude Bellingham', 'Goal', '76:22', '76:28', 6, 'Spectacular overhead kick from outside the box', '${JSON.stringify(["bicycle-kick", "goal", "spectacular", "champions-league"])}', 'https://example.com/highlights/bicycle1.mp4', 'https://example.com/thumbs/bicycle1.jpg', '${JSON.stringify({"excitement_level": 99, "key_moment": true, "virality_score": 97})}'),
      ('Slam Dunk Contest Winner', 'Basketball', 'NBA All-Star Weekend', 'Various', 'Ja Morant', 'Dunk', 'Final', 'Final', 8, '360 windmill from the free throw line', '${JSON.stringify(["dunk", "all-star", "360", "spectacular"])}', 'https://example.com/highlights/dunk1.mp4', 'https://example.com/thumbs/dunk1.jpg', '${JSON.stringify({"excitement_level": 93, "key_moment": true, "virality_score": 90})}'),
      ('Penalty Save Sequence', 'Soccer', 'World Cup Final', 'Argentina', 'Emiliano Martinez', 'Save', 'PK:5', 'PK:5', 15, 'Three consecutive saves to win the shootout', '${JSON.stringify(["penalty", "save", "world-cup", "dramatic"])}', 'https://example.com/highlights/save1.mp4', 'https://example.com/thumbs/save1.jpg', '${JSON.stringify({"excitement_level": 98, "key_moment": true, "virality_score": 96})}'),
      ('Walk-Off Grand Slam', 'Baseball', 'ALCS Game 5', 'Houston Astros', 'Jose Altuve', 'Home Run', '9th:2out', '9th:2out', 20, 'Walk-off grand slam to advance to the World Series', '${JSON.stringify(["walk-off", "grand-slam", "playoffs", "dramatic"])}', 'https://example.com/highlights/walkoff1.mp4', 'https://example.com/thumbs/walkoff1.jpg', '${JSON.stringify({"excitement_level": 97, "key_moment": true, "virality_score": 95})}'),
      ('Hail Mary Touchdown', 'Football', 'Playoff Game', 'Dallas Cowboys', 'CeeDee Lamb', 'Touchdown', 'Q4:0:02', 'Q4:0:00', 10, '65-yard Hail Mary caught in the end zone as time expires', '${JSON.stringify(["hail-mary", "touchdown", "playoffs", "miracle"])}', 'https://example.com/highlights/hailmary1.mp4', 'https://example.com/thumbs/hailmary1.jpg', '${JSON.stringify({"excitement_level": 99, "key_moment": true, "virality_score": 98})}'),
      ('Triple Double Performance', 'Basketball', 'Regular Season', 'Denver Nuggets', 'Nikola Jokic', 'Performance', 'Full Game', 'Full Game', 180, '30 points, 20 rebounds, 15 assists triple-double', '${JSON.stringify(["triple-double", "historic", "performance", "mvp"])}', 'https://example.com/highlights/triple1.mp4', 'https://example.com/thumbs/triple1.jpg', '${JSON.stringify({"excitement_level": 85, "key_moment": true, "virality_score": 80})}'),
      ('Comeback Victory', 'Tennis', 'US Open Final', 'Individual', 'Novak Djokovic', 'Match Point', 'Set5:7-5', 'Set5:7-5', 8, 'Winning match point after being down 2 sets', '${JSON.stringify(["comeback", "match-point", "us-open", "historic"])}', 'https://example.com/highlights/comeback1.mp4', 'https://example.com/thumbs/comeback1.jpg', '${JSON.stringify({"excitement_level": 94, "key_moment": true, "virality_score": 91})}')
    `);

    // Seed General Highlights (16 items)
    console.log('Seeding general highlights...');
    await pool.query(`
      INSERT INTO highlights (title, source_type, content_type, start_time, end_time, duration, description, importance_score, keywords, transcript_snippet, video_url, thumbnail_url, ai_analysis) VALUES
      ('CEO Keynote Opening', 'Conference', 'Presentation', '00:00:00', '00:02:30', 150, 'Powerful opening statement about company vision', 95, '${JSON.stringify(["keynote", "vision", "leadership", "strategy"])}', 'Today, I want to share with you our vision for the next decade...', 'https://example.com/highlights/keynote1.mp4', 'https://example.com/thumbs/keynote1.jpg', '${JSON.stringify({"engagement_score": 92, "shareability": 88, "key_message": true})}'),
      ('Product Demo Highlight', 'Webinar', 'Demo', '00:15:30', '00:18:45', 195, 'Most impressive product feature demonstration', 88, '${JSON.stringify(["demo", "product", "feature", "innovation"])}', 'Let me show you how this feature can save you hours of work...', 'https://example.com/highlights/demo1.mp4', 'https://example.com/thumbs/demo1.jpg', '${JSON.stringify({"engagement_score": 85, "shareability": 80, "key_message": true})}'),
      ('Customer Success Story', 'Interview', 'Testimonial', '00:05:00', '00:07:30', 150, 'Compelling customer sharing their transformation story', 92, '${JSON.stringify(["testimonial", "success", "customer", "transformation"])}', 'Before using this product, we struggled with...', 'https://example.com/highlights/success1.mp4', 'https://example.com/thumbs/success1.jpg', '${JSON.stringify({"engagement_score": 90, "shareability": 92, "key_message": true})}'),
      ('Expert Panel Discussion', 'Podcast', 'Discussion', '00:22:15', '00:26:00', 225, 'Industry experts debating future trends', 85, '${JSON.stringify(["panel", "experts", "trends", "industry"])}', 'The future of this industry lies in...', 'https://example.com/highlights/panel1.mp4', 'https://example.com/thumbs/panel1.jpg', '${JSON.stringify({"engagement_score": 82, "shareability": 78, "key_message": true})}'),
      ('Training Module Key Point', 'E-Learning', 'Education', '00:08:45', '00:11:00', 135, 'Critical learning moment from training video', 90, '${JSON.stringify(["training", "education", "key-concept", "learning"])}', 'The most important thing to remember is...', 'https://example.com/highlights/training1.mp4', 'https://example.com/thumbs/training1.jpg', '${JSON.stringify({"engagement_score": 88, "shareability": 75, "key_message": true})}'),
      ('Company Culture Moment', 'Documentary', 'Culture', '00:12:00', '00:14:30', 150, 'Authentic moment showcasing company values', 87, '${JSON.stringify(["culture", "values", "team", "authentic"])}', 'What makes our team special is...', 'https://example.com/highlights/culture1.mp4', 'https://example.com/thumbs/culture1.jpg', '${JSON.stringify({"engagement_score": 85, "shareability": 88, "key_message": true})}'),
      ('Award Acceptance Speech', 'Event', 'Speech', '00:45:00', '00:47:30', 150, 'Emotional award acceptance with key message', 93, '${JSON.stringify(["award", "speech", "emotional", "recognition"])}', 'This award represents the hard work of our entire team...', 'https://example.com/highlights/award1.mp4', 'https://example.com/thumbs/award1.jpg', '${JSON.stringify({"engagement_score": 91, "shareability": 90, "key_message": true})}'),
      ('Product Launch Announcement', 'Live Stream', 'Announcement', '00:30:00', '00:33:00', 180, 'Exciting new product reveal moment', 96, '${JSON.stringify(["launch", "product", "announcement", "exciting"])}', 'Today, we are thrilled to announce...', 'https://example.com/highlights/launch1.mp4', 'https://example.com/thumbs/launch1.jpg', '${JSON.stringify({"engagement_score": 95, "shareability": 94, "key_message": true})}'),
      ('Q&A Best Response', 'Webinar', 'Q&A', '00:55:00', '00:57:00', 120, 'Most valuable question and answer moment', 84, '${JSON.stringify(["qa", "response", "valuable", "insight"])}', 'That is a great question. The answer is...', 'https://example.com/highlights/qa1.mp4', 'https://example.com/thumbs/qa1.jpg', '${JSON.stringify({"engagement_score": 82, "shareability": 76, "key_message": true})}'),
      ('Behind-the-Scenes Moment', 'Documentary', 'BTS', '00:18:00', '00:20:30', 150, 'Authentic behind-the-scenes look at operations', 80, '${JSON.stringify(["bts", "authentic", "operations", "insight"])}', 'Here is what really happens when...', 'https://example.com/highlights/bts1.mp4', 'https://example.com/thumbs/bts1.jpg', '${JSON.stringify({"engagement_score": 78, "shareability": 82, "key_message": false})}'),
      ('Founder Story Origin', 'Interview', 'Story', '00:03:00', '00:06:00', 180, 'Founder sharing the origin story of the company', 91, '${JSON.stringify(["founder", "origin", "story", "inspiration"])}', 'It all started when I realized...', 'https://example.com/highlights/origin1.mp4', 'https://example.com/thumbs/origin1.jpg', '${JSON.stringify({"engagement_score": 89, "shareability": 91, "key_message": true})}'),
      ('Team Celebration Moment', 'Event', 'Celebration', '01:15:00', '01:17:00', 120, 'Team celebrating a major milestone', 82, '${JSON.stringify(["celebration", "team", "milestone", "culture"])}', 'We did it! This represents months of hard work...', 'https://example.com/highlights/celebrate1.mp4', 'https://example.com/thumbs/celebrate1.jpg', '${JSON.stringify({"engagement_score": 80, "shareability": 85, "key_message": false})}'),
      ('Technical Deep Dive', 'Webinar', 'Technical', '00:35:00', '00:40:00', 300, 'In-depth technical explanation of architecture', 78, '${JSON.stringify(["technical", "architecture", "deep-dive", "engineering"])}', 'Let me walk you through the technical architecture...', 'https://example.com/highlights/technical1.mp4', 'https://example.com/thumbs/technical1.jpg', '${JSON.stringify({"engagement_score": 75, "shareability": 65, "key_message": true})}'),
      ('Inspirational Quote Moment', 'Conference', 'Quote', '00:42:00', '00:43:00', 60, 'Powerful quote that resonated with audience', 89, '${JSON.stringify(["quote", "inspirational", "memorable", "impactful"])}', 'Remember, success is not about perfection...', 'https://example.com/highlights/quote1.mp4', 'https://example.com/thumbs/quote1.jpg', '${JSON.stringify({"engagement_score": 87, "shareability": 93, "key_message": true})}'),
      ('Case Study Results', 'Presentation', 'Case Study', '00:25:00', '00:28:00', 180, 'Impressive case study results presentation', 86, '${JSON.stringify(["case-study", "results", "data", "success"])}', 'The results speak for themselves. We achieved...', 'https://example.com/highlights/case1.mp4', 'https://example.com/thumbs/case1.jpg', '${JSON.stringify({"engagement_score": 84, "shareability": 80, "key_message": true})}'),
      ('Industry Prediction', 'Podcast', 'Prediction', '00:48:00', '00:51:00', 180, 'Bold industry prediction that generated buzz', 83, '${JSON.stringify(["prediction", "industry", "future", "bold"])}', 'In the next five years, I predict...', 'https://example.com/highlights/predict1.mp4', 'https://example.com/thumbs/predict1.jpg', '${JSON.stringify({"engagement_score": 81, "shareability": 86, "key_message": true})}')
    `);

    // Seed B-Roll Suggestions (16 items)
    console.log('Seeding B-roll suggestions...');
    await pool.query(`
      INSERT INTO broll_suggestions (title, context, industry, mood, keywords, suggestions, stock_sources, style_notes, color_palette) VALUES
      ('Tech Startup Office', 'Modern startup testimonial', 'Technology', 'Energetic', '${JSON.stringify(["startup", "office", "modern", "team"])}', '${JSON.stringify([{"type": "Open office space with developers coding", "duration": "5-10s"}, {"type": "Team collaboration at whiteboard", "duration": "5-8s"}, {"type": "Close-up of hands typing on keyboard", "duration": "3-5s"}, {"type": "Modern workspace with plants", "duration": "5-7s"}])}', '${JSON.stringify(["Pexels", "Unsplash", "Shutterstock"])}', 'Focus on natural lighting, candid moments, modern aesthetic', '${JSON.stringify(["#667eea", "#764ba2", "#f8fafc"])}'),
      ('Healthcare Environment', 'Medical testimonial video', 'Healthcare', 'Calm', '${JSON.stringify(["medical", "healthcare", "hospital", "care"])}', '${JSON.stringify([{"type": "Doctor consulting with patient", "duration": "5-8s"}, {"type": "Modern hospital corridor", "duration": "4-6s"}, {"type": "Medical equipment close-up", "duration": "3-5s"}, {"type": "Healthcare professional reviewing charts", "duration": "5-7s"}])}', '${JSON.stringify(["Getty Images", "Shutterstock", "Adobe Stock"])}', 'Clean, sterile environments, warm patient interactions', '${JSON.stringify(["#2c7a7b", "#ffffff", "#e2e8f0"])}'),
      ('Corporate Finance', 'Financial services testimonial', 'Finance', 'Professional', '${JSON.stringify(["finance", "corporate", "business", "professional"])}', '${JSON.stringify([{"type": "Business meeting in conference room", "duration": "5-8s"}, {"type": "Financial charts on screen", "duration": "4-6s"}, {"type": "Executive handshake", "duration": "3-5s"}, {"type": "Modern office building exterior", "duration": "5-7s"}])}', '${JSON.stringify(["Shutterstock", "Getty Images", "iStock"])}', 'Convey trust, stability, and professionalism', '${JSON.stringify(["#1a365d", "#2d3748", "#edf2f7"])}'),
      ('Creative Agency', 'Creative industry testimonial', 'Creative', 'Dynamic', '${JSON.stringify(["creative", "design", "artistic", "colorful"])}', '${JSON.stringify([{"type": "Design team brainstorming", "duration": "5-8s"}, {"type": "Artist working on digital artwork", "duration": "5-7s"}, {"type": "Colorful mood boards and samples", "duration": "4-6s"}, {"type": "Creative workspace with art supplies", "duration": "5-8s"}])}', '${JSON.stringify(["Pexels", "Unsplash", "Artgrid"])}', 'Vibrant colors, artistic elements, creative energy', '${JSON.stringify(["#ed64a6", "#f6ad55", "#9f7aea"])}'),
      ('Manufacturing Floor', 'Industrial testimonial', 'Manufacturing', 'Industrial', '${JSON.stringify(["manufacturing", "factory", "production", "industrial"])}', '${JSON.stringify([{"type": "Factory floor with machinery", "duration": "5-8s"}, {"type": "Workers operating equipment", "duration": "5-7s"}, {"type": "Quality control inspection", "duration": "4-6s"}, {"type": "Automated production line", "duration": "5-8s"}])}', '${JSON.stringify(["Shutterstock", "Getty Images", "Pond5"])}', 'Show precision, efficiency, and scale', '${JSON.stringify(["#4a5568", "#e2e8f0", "#f59e0b"])}'),
      ('Retail Store', 'Retail business testimonial', 'Retail', 'Welcoming', '${JSON.stringify(["retail", "store", "shopping", "customer"])}', '${JSON.stringify([{"type": "Customer shopping experience", "duration": "5-8s"}, {"type": "Store display arrangement", "duration": "4-6s"}, {"type": "Checkout interaction", "duration": "4-6s"}, {"type": "Happy customers with purchases", "duration": "5-7s"}])}', '${JSON.stringify(["Pexels", "Shutterstock", "Unsplash"])}', 'Focus on customer experience and satisfaction', '${JSON.stringify(["#e53e3e", "#48bb78", "#ffffff"])}'),
      ('Education Campus', 'Educational institution testimonial', 'Education', 'Inspiring', '${JSON.stringify(["education", "campus", "learning", "students"])}', '${JSON.stringify([{"type": "Students in classroom", "duration": "5-8s"}, {"type": "Library study session", "duration": "5-7s"}, {"type": "Campus grounds and buildings", "duration": "4-6s"}, {"type": "Graduation ceremony", "duration": "5-8s"}])}', '${JSON.stringify(["Getty Images", "Shutterstock", "Pexels"])}', 'Show growth, learning, and achievement', '${JSON.stringify(["#f6ad55", "#4299e1", "#48bb78"])}'),
      ('Hospitality Venue', 'Hotel and hospitality testimonial', 'Hospitality', 'Luxurious', '${JSON.stringify(["hotel", "hospitality", "service", "luxury"])}', '${JSON.stringify([{"type": "Hotel lobby and reception", "duration": "5-8s"}, {"type": "Room service and amenities", "duration": "5-7s"}, {"type": "Restaurant dining experience", "duration": "4-6s"}, {"type": "Guest enjoying facilities", "duration": "5-8s"}])}', '${JSON.stringify(["Shutterstock", "Getty Images", "Adobe Stock"])}', 'Emphasize comfort, service, and elegance', '${JSON.stringify(["#d69e2e", "#744210", "#f7fafc"])}'),
      ('Logistics Operations', 'Supply chain testimonial', 'Logistics', 'Efficient', '${JSON.stringify(["logistics", "shipping", "warehouse", "delivery"])}', '${JSON.stringify([{"type": "Warehouse operations", "duration": "5-8s"}, {"type": "Truck loading and delivery", "duration": "5-7s"}, {"type": "Package tracking screen", "duration": "4-5s"}, {"type": "Fleet of delivery vehicles", "duration": "5-7s"}])}', '${JSON.stringify(["Shutterstock", "Pond5", "Getty Images"])}', 'Show speed, organization, and reliability', '${JSON.stringify(["#3182ce", "#e53e3e", "#edf2f7"])}'),
      ('Nonprofit Work', 'Charitable organization testimonial', 'Nonprofit', 'Heartfelt', '${JSON.stringify(["nonprofit", "charity", "community", "impact"])}', '${JSON.stringify([{"type": "Community outreach activities", "duration": "5-8s"}, {"type": "Volunteers working together", "duration": "5-7s"}, {"type": "Impact on beneficiaries", "duration": "5-8s"}, {"type": "Fundraising event", "duration": "4-6s"}])}', '${JSON.stringify(["Pexels", "Unsplash", "Getty Images"])}', 'Show impact, compassion, and community', '${JSON.stringify(["#48bb78", "#ed8936", "#f7fafc"])}'),
      ('SaaS Product', 'Software product testimonial', 'SaaS', 'Modern', '${JSON.stringify(["software", "saas", "technology", "digital"])}', '${JSON.stringify([{"type": "User interacting with software", "duration": "5-8s"}, {"type": "Dashboard and analytics view", "duration": "4-6s"}, {"type": "Team video conference", "duration": "5-7s"}, {"type": "Laptop and mobile devices", "duration": "4-6s"}])}', '${JSON.stringify(["Pexels", "Shutterstock", "Unsplash"])}', 'Clean interfaces, modern devices, productivity', '${JSON.stringify(["#5a67d8", "#4fd1c5", "#ffffff"])}'),
      ('Real Estate Property', 'Real estate testimonial', 'Real Estate', 'Aspirational', '${JSON.stringify(["real-estate", "property", "home", "luxury"])}', '${JSON.stringify([{"type": "Property exterior and grounds", "duration": "5-8s"}, {"type": "Interior home tour", "duration": "6-10s"}, {"type": "Family enjoying home", "duration": "5-7s"}, {"type": "Agent showing property", "duration": "5-7s"}])}', '${JSON.stringify(["Getty Images", "Shutterstock", "Adobe Stock"])}', 'Showcase luxury, comfort, and lifestyle', '${JSON.stringify(["#744210", "#2d3748", "#f7fafc"])}'),
      ('Fitness Center', 'Fitness and health testimonial', 'Fitness', 'Energetic', '${JSON.stringify(["fitness", "gym", "health", "workout"])}', '${JSON.stringify([{"type": "People working out in gym", "duration": "5-8s"}, {"type": "Personal training session", "duration": "5-7s"}, {"type": "Group fitness class", "duration": "4-6s"}, {"type": "Before and after transformation", "duration": "5-8s"}])}', '${JSON.stringify(["Pexels", "Shutterstock", "Artgrid"])}', 'Show energy, transformation, and motivation', '${JSON.stringify(["#dd6b20", "#e53e3e", "#2d3748"])}'),
      ('Legal Office', 'Legal services testimonial', 'Legal', 'Authoritative', '${JSON.stringify(["legal", "law", "attorney", "professional"])}', '${JSON.stringify([{"type": "Attorney in office", "duration": "5-7s"}, {"type": "Legal team meeting", "duration": "5-8s"}, {"type": "Law library and books", "duration": "4-6s"}, {"type": "Client consultation", "duration": "5-7s"}])}', '${JSON.stringify(["Getty Images", "Shutterstock", "iStock"])}', 'Convey authority, trust, and expertise', '${JSON.stringify(["#1a202c", "#2d3748", "#edf2f7"])}'),
      ('E-commerce Operations', 'Online retail testimonial', 'E-commerce', 'Dynamic', '${JSON.stringify(["ecommerce", "online", "shopping", "digital"])}', '${JSON.stringify([{"type": "Order fulfillment center", "duration": "5-8s"}, {"type": "Package unboxing experience", "duration": "4-6s"}, {"type": "Customer receiving delivery", "duration": "5-7s"}, {"type": "Online shopping on device", "duration": "4-6s"}])}', '${JSON.stringify(["Pexels", "Shutterstock", "Pond5"])}', 'Show convenience, speed, and satisfaction', '${JSON.stringify(["#319795", "#9f7aea", "#ffffff"])}'),
      ('Construction Site', 'Construction company testimonial', 'Construction', 'Industrial', '${JSON.stringify(["construction", "building", "development", "project"])}', '${JSON.stringify([{"type": "Construction site activity", "duration": "5-8s"}, {"type": "Workers and heavy equipment", "duration": "5-7s"}, {"type": "Building progress timelapse", "duration": "6-10s"}, {"type": "Completed project reveal", "duration": "5-7s"}])}', '${JSON.stringify(["Shutterstock", "Getty Images", "Pond5"])}', 'Show progress, teamwork, and results', '${JSON.stringify(["#ed8936", "#2d3748", "#4299e1"])}')
    `);

    // Seed Music Matches (16 items)
    console.log('Seeding music matches...');
    await pool.query(`
      INSERT INTO music_matches (title, content_type, mood, genre, tempo, energy_level, duration, suggestions, licensing_info, style_notes) VALUES
      ('Corporate Inspiration', 'Testimonial', 'Inspiring', 'Corporate', 'Medium', 'Medium-High', 60, '${JSON.stringify([{"track": "Rising Success", "artist": "Corporate Sounds", "bpm": 120, "key": "C Major"}, {"track": "Forward Motion", "artist": "Business Beats", "bpm": 115, "key": "G Major"}, {"track": "Achievement", "artist": "Pro Audio", "bpm": 118, "key": "D Major"}])}', 'Royalty-free, commercial use allowed', 'Professional, uplifting, builds toward conclusion'),
      ('Tech Innovation', 'Product Demo', 'Futuristic', 'Electronic', 'Fast', 'High', 45, '${JSON.stringify([{"track": "Digital Frontier", "artist": "Synth Masters", "bpm": 128, "key": "A Minor"}, {"track": "Innovation Drive", "artist": "Tech Beats", "bpm": 125, "key": "E Minor"}, {"track": "Future Forward", "artist": "Electronic Pro", "bpm": 130, "key": "F Minor"}])}', 'Royalty-free with attribution', 'Modern, innovative, energetic'),
      ('Emotional Story', 'Customer Story', 'Emotional', 'Cinematic', 'Slow', 'Low-Medium', 90, '${JSON.stringify([{"track": "Journey Home", "artist": "Cinematic Scores", "bpm": 72, "key": "F Major"}, {"track": "Heartfelt Moments", "artist": "Film Music", "bpm": 68, "key": "Bb Major"}, {"track": "Story Unfolds", "artist": "Orchestra Pro", "bpm": 75, "key": "Eb Major"}])}', 'Premium license required', 'Build emotion gradually, orchestral elements'),
      ('Startup Energy', 'Brand Video', 'Energetic', 'Indie Pop', 'Fast', 'High', 30, '${JSON.stringify([{"track": "New Beginnings", "artist": "Indie Collective", "bpm": 135, "key": "G Major"}, {"track": "Rise Up", "artist": "Pop Fusion", "bpm": 140, "key": "D Major"}, {"track": "Momentum", "artist": "Fresh Sounds", "bpm": 132, "key": "A Major"}])}', 'Royalty-free, unlimited use', 'Youthful, optimistic, driving rhythm'),
      ('Healthcare Calm', 'Healthcare Content', 'Calm', 'Ambient', 'Slow', 'Low', 60, '${JSON.stringify([{"track": "Healing Presence", "artist": "Ambient Works", "bpm": 60, "key": "C Major"}, {"track": "Peaceful Care", "artist": "Meditation Music", "bpm": 55, "key": "G Major"}, {"track": "Gentle Support", "artist": "Wellness Audio", "bpm": 58, "key": "F Major"}])}', 'Royalty-free, medical use approved', 'Soothing, non-intrusive, professional'),
      ('Finance Trust', 'Financial Services', 'Confident', 'Classical Fusion', 'Medium', 'Medium', 45, '${JSON.stringify([{"track": "Solid Ground", "artist": "Classical Modern", "bpm": 90, "key": "D Major"}, {"track": "Trust Built", "artist": "Finance Music", "bpm": 85, "key": "G Major"}, {"track": "Secure Future", "artist": "Business Classics", "bpm": 88, "key": "C Major"}])}', 'Premium license, broadcast rights included', 'Sophisticated, trustworthy, timeless'),
      ('Creative Expression', 'Creative Agency', 'Playful', 'Jazz Fusion', 'Medium-Fast', 'Medium-High', 30, '${JSON.stringify([{"track": "Creative Flow", "artist": "Jazz Collective", "bpm": 118, "key": "Bb Major"}, {"track": "Artful Touch", "artist": "Fusion Masters", "bpm": 122, "key": "Eb Major"}, {"track": "Imagination", "artist": "Creative Beats", "bpm": 115, "key": "Ab Major"}])}', 'Royalty-free, unlimited projects', 'Sophisticated, creative, memorable'),
      ('Retail Excitement', 'Retail Promo', 'Exciting', 'Pop Dance', 'Fast', 'High', 30, '${JSON.stringify([{"track": "Shopping Spree", "artist": "Pop Hits", "bpm": 128, "key": "A Major"}, {"track": "Deal Hunter", "artist": "Dance Pop", "bpm": 132, "key": "E Major"}, {"track": "Happy Buyer", "artist": "Commercial Beats", "bpm": 125, "key": "D Major"}])}', 'Commercial license required', 'Upbeat, catchy, drives action'),
      ('Education Journey', 'Educational Content', 'Curious', 'Folk Acoustic', 'Medium', 'Medium', 60, '${JSON.stringify([{"track": "Learning Path", "artist": "Acoustic Ensemble", "bpm": 95, "key": "G Major"}, {"track": "Discovery", "artist": "Folk Fusion", "bpm": 90, "key": "C Major"}, {"track": "Growing Minds", "artist": "Edu Music", "bpm": 92, "key": "D Major"}])}', 'Royalty-free, educational use', 'Warm, approachable, encourages learning'),
      ('Hospitality Luxury', 'Hotel Promo', 'Luxurious', 'Lounge', 'Slow-Medium', 'Low-Medium', 60, '${JSON.stringify([{"track": "Suite Dreams", "artist": "Lounge Masters", "bpm": 85, "key": "F Major"}, {"track": "Elegant Stay", "artist": "Hotel Music", "bpm": 80, "key": "Bb Major"}, {"track": "Premium Experience", "artist": "Luxury Sounds", "bpm": 82, "key": "Eb Major"}])}', 'Premium license, venue use allowed', 'Elegant, sophisticated, welcoming'),
      ('Fitness Motivation', 'Fitness Content', 'Motivating', 'EDM', 'Fast', 'Very High', 30, '${JSON.stringify([{"track": "Push Harder", "artist": "Workout Beats", "bpm": 140, "key": "A Minor"}, {"track": "No Limits", "artist": "Gym Music", "bpm": 145, "key": "E Minor"}, {"track": "Beast Mode", "artist": "EDM Fitness", "bpm": 142, "key": "D Minor"}])}', 'Royalty-free, gym use approved', 'High energy, driving, motivational'),
      ('Legal Authority', 'Legal Services', 'Authoritative', 'Classical', 'Slow', 'Low-Medium', 45, '${JSON.stringify([{"track": "Justice Prevails", "artist": "Classical Masters", "bpm": 70, "key": "D Minor"}, {"track": "Due Process", "artist": "Legal Music", "bpm": 65, "key": "G Minor"}, {"track": "Counsel", "artist": "Chamber Music", "bpm": 68, "key": "C Minor"}])}', 'Premium license required', 'Dignified, serious, trustworthy'),
      ('Nonprofit Heart', 'Charity Video', 'Heartwarming', 'Acoustic Piano', 'Slow', 'Low-Medium', 90, '${JSON.stringify([{"track": "Making Difference", "artist": "Piano Stories", "bpm": 72, "key": "C Major"}, {"track": "Hope Rising", "artist": "Emotional Piano", "bpm": 68, "key": "F Major"}, {"track": "Community Spirit", "artist": "Charity Music", "bpm": 75, "key": "G Major"}])}', 'Free for nonprofits', 'Emotional, hopeful, inspiring'),
      ('E-commerce Fast', 'Online Shopping', 'Trendy', 'Trap Pop', 'Fast', 'High', 15, '${JSON.stringify([{"track": "Click to Cart", "artist": "Trend Setters", "bpm": 138, "key": "G Minor"}, {"track": "Deal Sealed", "artist": "Digital Commerce", "bpm": 142, "key": "D Minor"}, {"track": "Shop Now", "artist": "Modern Beats", "bpm": 136, "key": "A Minor"}])}', 'Royalty-free, digital use', 'Trendy, fast-paced, youth-oriented'),
      ('Construction Strong', 'Construction Promo', 'Powerful', 'Rock', 'Medium-Fast', 'High', 45, '${JSON.stringify([{"track": "Building Dreams", "artist": "Rock Solid", "bpm": 120, "key": "E Major"}, {"track": "Foundation", "artist": "Power Rock", "bpm": 118, "key": "A Major"}, {"track": "Steel Strong", "artist": "Construction Rock", "bpm": 122, "key": "D Major"}])}', 'Commercial license, broadcast rights', 'Strong, determined, action-oriented'),
      ('SaaS Modern', 'Software Demo', 'Professional', 'Synth Pop', 'Medium', 'Medium', 60, '${JSON.stringify([{"track": "Digital Solutions", "artist": "Synth Works", "bpm": 110, "key": "A Minor"}, {"track": "Cloud Connected", "artist": "Modern Pop", "bpm": 108, "key": "E Minor"}, {"track": "Software Flow", "artist": "Tech Pop", "bpm": 112, "key": "D Minor"}])}', 'Royalty-free, unlimited use', 'Modern, clean, professional')
    `);

    // Seed Transcripts (16 items)
    console.log('Seeding transcripts...');
    await pool.query(`
      INSERT INTO transcripts (title, source_type, language, duration, content, timestamps, speakers, keywords, summary, confidence_score, video_url) VALUES
      ('Q1 Earnings Call', 'Conference Call', 'English', 3600, 'Good morning everyone. Thank you for joining our Q1 earnings call. I am pleased to report that we exceeded expectations this quarter with revenue growth of 25 percent year over year. Our customer acquisition costs decreased by 15 percent while lifetime value increased. Looking ahead, we are investing heavily in R&D to maintain our competitive advantage...', '${JSON.stringify([{"time": "00:00:00", "text": "Good morning everyone"}, {"time": "00:01:30", "text": "Revenue growth of 25 percent"}, {"time": "00:05:00", "text": "Customer acquisition costs decreased"}])}', '${JSON.stringify([{"name": "CEO", "segments": 15}, {"name": "CFO", "segments": 8}, {"name": "Analyst", "segments": 5}])}', '${JSON.stringify(["earnings", "revenue", "growth", "Q1", "investment"])}', 'Q1 earnings exceeded expectations with 25% revenue growth and reduced customer acquisition costs.', 97.5, 'https://example.com/transcripts/earnings1.mp4'),
      ('Customer Success Interview', 'Interview', 'English', 1800, 'Thank you for having me today. I have been using your platform for about six months now, and I have to say, it has completely transformed how we work. Before we implemented your solution, our team was spending hours on manual data entry. Now, everything is automated. The time savings alone have been incredible...', '${JSON.stringify([{"time": "00:00:00", "text": "Thank you for having me"}, {"time": "00:02:00", "text": "completely transformed how we work"}, {"time": "00:04:30", "text": "everything is automated"}])}', '${JSON.stringify([{"name": "Customer", "segments": 12}, {"name": "Interviewer", "segments": 8}])}', '${JSON.stringify(["transformation", "automation", "time-savings", "efficiency", "testimonial"])}', 'Customer testimonial highlighting 6 months of usage, automation benefits, and significant time savings.', 95.2, 'https://example.com/transcripts/interview1.mp4'),
      ('Product Launch Keynote', 'Keynote', 'English', 5400, 'Welcome to our annual product launch event. Today marks a significant milestone in our company history. We are introducing three revolutionary products that will change how you work. The first is our AI-powered analytics platform. The second is our new collaboration suite. And third, our enterprise security solution...', '${JSON.stringify([{"time": "00:00:00", "text": "Welcome to our annual product launch"}, {"time": "00:03:00", "text": "three revolutionary products"}, {"time": "00:10:00", "text": "AI-powered analytics platform"}])}', '${JSON.stringify([{"name": "CEO", "segments": 25}, {"name": "CTO", "segments": 15}, {"name": "Product Manager", "segments": 10}])}', '${JSON.stringify(["launch", "product", "AI", "analytics", "collaboration", "security"])}', 'Product launch event introducing AI analytics platform, collaboration suite, and enterprise security solution.', 98.1, 'https://example.com/transcripts/keynote1.mp4'),
      ('Training Session Module 1', 'Training', 'English', 2700, 'Welcome to module one of our comprehensive training program. In this session, we will cover the basics of navigating the platform. First, let us look at the dashboard. You will notice the main navigation menu on the left side. From here, you can access all major features. Click on Settings to customize your experience...', '${JSON.stringify([{"time": "00:00:00", "text": "Welcome to module one"}, {"time": "00:02:30", "text": "navigating the platform"}, {"time": "00:05:00", "text": "main navigation menu"}])}', '${JSON.stringify([{"name": "Trainer", "segments": 20}])}', '${JSON.stringify(["training", "navigation", "dashboard", "settings", "basics"])}', 'Training module covering platform basics, navigation, and dashboard customization.', 96.8, 'https://example.com/transcripts/training1.mp4'),
      ('Expert Panel Discussion', 'Panel', 'English', 4200, 'Thank you all for joining this expert panel. Today we are discussing the future of AI in enterprise software. Let me start by asking each panelist their perspective. The first point I want to make is that AI is not replacing humans, it is augmenting our capabilities. I agree, and I would add that the key is finding the right balance...', '${JSON.stringify([{"time": "00:00:00", "text": "Thank you all for joining"}, {"time": "00:03:00", "text": "future of AI in enterprise"}, {"time": "00:08:00", "text": "AI is not replacing humans"}])}', '${JSON.stringify([{"name": "Moderator", "segments": 10}, {"name": "Expert 1", "segments": 12}, {"name": "Expert 2", "segments": 11}, {"name": "Expert 3", "segments": 9}])}', '${JSON.stringify(["AI", "enterprise", "future", "augmentation", "technology"])}', 'Expert panel discussing AI in enterprise software, focusing on human augmentation rather than replacement.', 94.7, 'https://example.com/transcripts/panel1.mp4'),
      ('Webinar: Best Practices', 'Webinar', 'English', 3000, 'Hello everyone and welcome to today''s webinar on best practices for customer success. I am going to share insights from working with over 500 customers. The first principle is proactive communication. Do not wait for customers to reach out with problems. The second is data-driven decision making...', '${JSON.stringify([{"time": "00:00:00", "text": "Hello everyone and welcome"}, {"time": "00:02:00", "text": "best practices for customer success"}, {"time": "00:06:00", "text": "proactive communication"}])}', '${JSON.stringify([{"name": "Presenter", "segments": 22}, {"name": "Q&A Participant", "segments": 5}])}', '${JSON.stringify(["webinar", "best-practices", "customer-success", "communication", "data-driven"])}', 'Webinar sharing customer success best practices from 500+ customer engagements.', 95.9, 'https://example.com/transcripts/webinar1.mp4'),
      ('Podcast Episode: Growth', 'Podcast', 'English', 2400, 'Welcome back to another episode of Growth Mindset. Today I am speaking with the founder of one of the fastest growing startups. Tell us about your journey. Well, it started in my garage five years ago. We had a simple idea: make enterprise software accessible to small businesses...', '${JSON.stringify([{"time": "00:00:00", "text": "Welcome back to another episode"}, {"time": "00:01:30", "text": "fastest growing startups"}, {"time": "00:04:00", "text": "started in my garage"}])}', '${JSON.stringify([{"name": "Host", "segments": 15}, {"name": "Guest", "segments": 18}])}', '${JSON.stringify(["podcast", "growth", "startup", "founder", "journey"])}', 'Podcast interview with startup founder discussing their journey from garage to fast-growing company.', 93.4, 'https://example.com/transcripts/podcast1.mp4'),
      ('Town Hall Meeting', 'Internal', 'English', 4500, 'Good afternoon team. Thank you for joining our quarterly town hall. I want to start by celebrating our achievements. We hit 98 percent of our targets this quarter. I also want to acknowledge the challenges we faced and how we overcame them as a team. Looking ahead, we have some exciting announcements...', '${JSON.stringify([{"time": "00:00:00", "text": "Good afternoon team"}, {"time": "00:02:00", "text": "quarterly town hall"}, {"time": "00:05:30", "text": "98 percent of our targets"}])}', '${JSON.stringify([{"name": "CEO", "segments": 20}, {"name": "Department Heads", "segments": 15}, {"name": "Employee Q&A", "segments": 8}])}', '${JSON.stringify(["town-hall", "achievements", "targets", "announcements", "team"])}', 'Quarterly town hall celebrating 98% target achievement and discussing future plans.', 97.2, 'https://example.com/transcripts/townhall1.mp4'),
      ('Sales Demo Recording', 'Demo', 'English', 1200, 'Thank you for taking the time to see our demo today. I understand you are looking for a solution to streamline your operations. Let me show you exactly how our platform addresses your needs. First, here is the main dashboard. You can see real-time metrics at a glance...', '${JSON.stringify([{"time": "00:00:00", "text": "Thank you for taking the time"}, {"time": "00:01:00", "text": "streamline your operations"}, {"time": "00:03:00", "text": "main dashboard"}])}', '${JSON.stringify([{"name": "Sales Rep", "segments": 15}, {"name": "Prospect", "segments": 8}])}', '${JSON.stringify(["demo", "sales", "dashboard", "operations", "solution"])}', 'Sales demo recording showing platform capabilities for operations streamlining.', 96.1, 'https://example.com/transcripts/demo1.mp4'),
      ('Investor Pitch', 'Pitch', 'English', 900, 'Thank you for the opportunity to pitch today. We are solving a 50 billion dollar problem in the enterprise software market. Our unique approach combines AI with human expertise. We have grown 300 percent year over year. We are seeking 10 million in Series A funding to accelerate growth...', '${JSON.stringify([{"time": "00:00:00", "text": "Thank you for the opportunity"}, {"time": "00:01:00", "text": "50 billion dollar problem"}, {"time": "00:05:00", "text": "300 percent year over year"}])}', '${JSON.stringify([{"name": "Founder", "segments": 12}, {"name": "Investor", "segments": 5}])}', '${JSON.stringify(["pitch", "investment", "growth", "Series-A", "funding"])}', 'Investor pitch for Series A funding, highlighting 300% YoY growth and $50B market opportunity.', 98.5, 'https://example.com/transcripts/pitch1.mp4'),
      ('Customer Support Call', 'Support', 'English', 600, 'Hello, thank you for calling support. How can I help you today? I am having trouble with the integration. Let me look into that for you. Can you tell me which integration you are trying to set up? The Salesforce integration. I see. Let me walk you through the correct configuration...', '${JSON.stringify([{"time": "00:00:00", "text": "Hello, thank you for calling"}, {"time": "00:01:00", "text": "trouble with the integration"}, {"time": "00:03:00", "text": "Salesforce integration"}])}', '${JSON.stringify([{"name": "Support Agent", "segments": 10}, {"name": "Customer", "segments": 8}])}', '${JSON.stringify(["support", "integration", "Salesforce", "troubleshooting", "help"])}', 'Customer support call resolving Salesforce integration configuration issues.', 94.3, 'https://example.com/transcripts/support1.mp4'),
      ('Leadership Workshop', 'Workshop', 'English', 7200, 'Welcome to our leadership development workshop. Over the next two hours, we will explore essential leadership skills. We will start with self-awareness, then move to communication, and finally team building. The first exercise is a self-assessment. Please take out your workbooks...', '${JSON.stringify([{"time": "00:00:00", "text": "Welcome to our leadership workshop"}, {"time": "00:05:00", "text": "essential leadership skills"}, {"time": "00:15:00", "text": "first exercise"}])}', '${JSON.stringify([{"name": "Facilitator", "segments": 30}, {"name": "Participants", "segments": 25}])}', '${JSON.stringify(["leadership", "workshop", "skills", "communication", "team-building"])}', 'Two-hour leadership workshop covering self-awareness, communication, and team building.', 95.6, 'https://example.com/transcripts/workshop1.mp4'),
      ('Board Meeting', 'Meeting', 'English', 5400, 'I call this board meeting to order. First item on the agenda is the financial report. As you can see, we are tracking ahead of plan. Revenue is up 30 percent. EBITDA improved by 25 percent. Next, we will discuss the strategic initiatives. The expansion into European markets is on track...', '${JSON.stringify([{"time": "00:00:00", "text": "I call this board meeting to order"}, {"time": "00:05:00", "text": "financial report"}, {"time": "00:20:00", "text": "expansion into European markets"}])}', '${JSON.stringify([{"name": "Chairman", "segments": 15}, {"name": "CEO", "segments": 12}, {"name": "CFO", "segments": 10}, {"name": "Board Members", "segments": 8}])}', '${JSON.stringify(["board", "meeting", "financial", "strategy", "expansion"])}', 'Board meeting covering financial report (30% revenue up) and European expansion strategy.', 98.9, 'https://example.com/transcripts/board1.mp4'),
      ('User Feedback Session', 'Focus Group', 'English', 3600, 'Thank you all for participating in this feedback session. We want to understand how you use our product and what we can improve. Let us start with your overall experience. I really like the interface. It is intuitive. I agree, but I wish the reports were more customizable...', '${JSON.stringify([{"time": "00:00:00", "text": "Thank you all for participating"}, {"time": "00:03:00", "text": "overall experience"}, {"time": "00:08:00", "text": "reports were more customizable"}])}', '${JSON.stringify([{"name": "Moderator", "segments": 18}, {"name": "User 1", "segments": 12}, {"name": "User 2", "segments": 10}, {"name": "User 3", "segments": 11}])}', '${JSON.stringify(["feedback", "focus-group", "user-experience", "interface", "reports"])}', 'User feedback session discussing interface usability and report customization needs.', 93.8, 'https://example.com/transcripts/feedback1.mp4'),
      ('Annual Conference Keynote', 'Conference', 'English', 5400, 'Good morning and welcome to our annual conference. This year marks our tenth anniversary. Over the past decade, we have grown from a small startup to a global leader. Today, I want to share our vision for the next ten years. We call it Vision 2035. It is built on three pillars...', '${JSON.stringify([{"time": "00:00:00", "text": "Good morning and welcome"}, {"time": "00:05:00", "text": "tenth anniversary"}, {"time": "00:15:00", "text": "Vision 2035"}])}', '${JSON.stringify([{"name": "CEO", "segments": 30}, {"name": "CTO", "segments": 12}, {"name": "Guest Speaker", "segments": 10}])}', '${JSON.stringify(["conference", "keynote", "anniversary", "vision", "future"])}', 'Annual conference keynote celebrating 10-year anniversary and introducing Vision 2035.', 97.8, 'https://example.com/transcripts/conference1.mp4'),
      ('Product Roadmap Review', 'Internal', 'English', 2700, 'Let us review the product roadmap for the next two quarters. Q2 focus will be on performance improvements and the new analytics module. Q3 will introduce our mobile app and API v2. We are prioritizing based on customer feedback and market demands. The analytics module alone is requested by 80 percent of enterprise customers...', '${JSON.stringify([{"time": "00:00:00", "text": "review the product roadmap"}, {"time": "00:05:00", "text": "Q2 focus"}, {"time": "00:12:00", "text": "analytics module"}])}', '${JSON.stringify([{"name": "Product Manager", "segments": 18}, {"name": "Engineering Lead", "segments": 12}, {"name": "Design Lead", "segments": 8}])}', '${JSON.stringify(["roadmap", "product", "analytics", "mobile", "API"])}', 'Product roadmap review covering Q2-Q3 features: analytics module, mobile app, and API v2.', 96.4, 'https://example.com/transcripts/roadmap1.mp4')
    `);

    console.log('Seed completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Seed error:', error);
    process.exit(1);
  }
}

seed();
