export interface BriefData {
  prompt_version: string;
  generation_timestamp: string;
  generated_content_type: string;
  video_id: string;
  title: string;
  description: string;
  model_input_data: ModelInputData;
  product_input_data: ProductInputData;
  visual_generation_parameters: VisualGenerationParameters;
  audio_generation_parameters: AudioGenerationParameters;
  marketing_and_engagement_parameters: MarketingAndEngagementParameters;
}

export interface VideoPrompt {
  prompt: string;
  style: string;
  camera_motion: string;
  lighting: string;
  duration: number;
  aspect_ratio: string;
  sound: string;
  voice_over: {
    language: string;
    text: string;
  };
}

export interface ModelInputData {
  original_image_url: string;
  detected_features: {
    gender: string;
    age_range: string;
    ethnicity_likelihood: Array<{ name: string; likelihood: number }>;
    hair_color: string;
    hair_style: string;
    facial_structure_keywords: string[];
    body_type: string;
    skin_tone: string;
  };
}

export interface ProductInputData {
  original_image_url: string;
  user_provided_description: string;
  analyzed_features: {
    product_name: string;
    product_category: string;
    brand_name: string;
    primary_color: string;
    material_composition: string[];
    key_functions: string[];
    design_elements: string[];
    unique_selling_propositions: string[];
    missing_detail_assessment: {
      clarity_score: number;
      inferred_details: {
        display_type: string;
        battery_life_estimate: string;
      };
    };
  };
}

export interface VisualGenerationParameters {
  image_style_preset: string;
  aspect_ratio: string;
  resolution: string;
  camera_emulation: string;
  model_pose_and_expression: {
    overall_mood: string;
    body_pose: string;
    hand_placement: string;
    facial_expression: string;
  };
  product_placement_and_focus: {
    primary_product_visibility: string;
    secondary_product_visibility: string;
    focus_depth: string;
  };
  scene_and_environment: {
    location_type: string;
    background_elements: string[];
    time_of_day: string;
    weather_conditions: string;
    props_in_scene: string[];
  };
  lighting_and_color_grading: {
    light_source_type: string;
    light_direction: string;
    color_palette_mood: string;
    contrast_level: string;
    saturation_level: string;
    sharpening_amount: string;
  };
  video_specific_elements: {
    camera_movements: string[];
    transition_style: string;
    editing_pacing: string;
    text_overlays_recommendations: TextOverlay[];
    visual_effects_suggestions: string[];
  };
}

export interface TextOverlay {
  text: string;
  position: string;
  font_style: string;
  font_color: string;
  bg_color: string;
  animation: string;
}

export interface AudioGenerationParameters {
  voiceover: {
    language: string;
    accent: string;
    tone: string;
    speaking_rate: string;
    pitch_adjustment: string;
    script_lines: ScriptLine[];
    custom_voice_model_id: string | null;
  };
  background_music: {
    genre: string;
    mood: string;
    intensity: string;
    volume_level: string;
    track_suggestions: string[];
  };
  sound_effects: SoundEffect[];
}

export interface ScriptLine {
  speaker_tag: string;
  text: string;
}

export interface SoundEffect {
  name: string;
  timing: string;
  volume: string;
}

export interface MarketingAndEngagementParameters {
  call_to_action: {
    type: string;
    display_text: string;
    target_url_placeholder: string;
  };
  hashtags_suggestion: string[];
  target_audience: string;
  platform_optimization: string[];
}