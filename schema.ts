

import { Type } from "@google/genai";

export const scenePromptsSchema = {
  type: Type.OBJECT,
  properties: {
    prompts: {
      type: Type.ARRAY,
      description: "An array of unique and creative scene concepts.",
      items: {
        type: Type.OBJECT,
        properties: {
          scene_prompt: {
            type: Type.STRING,
            description: "A single, detailed paragraph describing a visual scene concept for an influencer-style video.",
          },
        },
        required: ["scene_prompt"],
      },
    },
  },
  required: ["prompts"],
};


export const videoPromptSchema = {
  type: Type.OBJECT,
  properties: {
    prompt: { type: Type.STRING, description: "A detailed, single-paragraph description of the visual scene, actions, and mood for an 8-second video." },
    style: { type: Type.STRING, description: "e.g., 'realistic cinematic', 'animated', 'vintage'." },
    camera_motion: { type: Type.STRING, description: "e.g., 'slow upward pan', 'dolly zoom'." },
    lighting: { type: Type.STRING, description: "e.g., 'soft golden hour light', 'dramatic neon'." },
    duration: { type: Type.INTEGER, description: "Video duration in seconds, typically 8." },
    aspect_ratio: { type: Type.STRING, description: "e.g., '16:9', '9:16'." },
    voice_over: {
        type: Type.OBJECT,
        properties: {
            language: { type: Type.STRING, description: "ISO 639-1 language code, e.g., 'id' for Indonesian." },
            text: { type: Type.STRING, description: "The full voiceover script as a single, concise string." }
        },
        required: ["language", "text"]
    }
  },
  required: ["prompt", "style", "camera_motion", "lighting", "duration", "aspect_ratio", "voice_over"]
};


export const briefDataSchema = {
  type: Type.OBJECT,
  properties: {
    prompt_version: { type: Type.STRING },
    generation_timestamp: { type: Type.STRING },
    generated_content_type: { type: Type.STRING },
    video_id: { type: Type.STRING },
    title: { type: Type.STRING, description: "A short, catchy title for the video." },
    description: { type: Type.STRING, description: "A concise one-sentence description of the video, under 150 characters." },
    model_input_data: {
      type: Type.OBJECT,
      properties: {
        original_image_url: { type: Type.STRING },
        detected_features: {
          type: Type.OBJECT,
          properties: {
            gender: { type: Type.STRING },
            age_range: { type: Type.STRING },
            ethnicity_likelihood: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING, description: "The name of the ethnicity." },
                  likelihood: { type: Type.NUMBER, description: "The likelihood score, from 0 to 1." }
                },
                required: ["name", "likelihood"]
              }
            },
            hair_color: { type: Type.STRING },
            hair_style: { type: Type.STRING },
            facial_structure_keywords: { type: Type.ARRAY, items: { type: Type.STRING } },
            body_type: { type: Type.STRING },
            skin_tone: { type: Type.STRING },
          },
        },
      },
    },
    product_input_data: {
      type: Type.OBJECT,
      properties: {
        original_image_url: { type: Type.STRING },
        user_provided_description: { type: Type.STRING },
        analyzed_features: {
          type: Type.OBJECT,
          properties: {
            product_name: { type: Type.STRING },
            product_category: { type: Type.STRING },
            brand_name: { type: Type.STRING },
            primary_color: { type: Type.STRING },
            material_composition: { type: Type.ARRAY, items: { type: Type.STRING } },
            key_functions: { type: Type.ARRAY, items: { type: Type.STRING } },
            design_elements: { type: Type.ARRAY, items: { type: Type.STRING } },
            unique_selling_propositions: { type: Type.ARRAY, items: { type: Type.STRING } },
            missing_detail_assessment: {
              type: Type.OBJECT,
              properties: {
                clarity_score: { type: Type.NUMBER },
                inferred_details: {
                  type: Type.OBJECT,
                  properties: {
                    display_type: { type: Type.STRING },
                    battery_life_estimate: { type: Type.STRING },
                  },
                },
              },
            },
          },
        },
      },
    },
    visual_generation_parameters: {
      type: Type.OBJECT,
      properties: {
        image_style_preset: { type: Type.STRING },
        aspect_ratio: { type: Type.STRING },
        resolution: { type: Type.STRING },
        camera_emulation: { type: Type.STRING },
        model_pose_and_expression: {
          type: Type.OBJECT,
          properties: {
            overall_mood: { type: Type.STRING },
            body_pose: { type: Type.STRING },
            hand_placement: { type: Type.STRING },
            facial_expression: { type: Type.STRING },
          },
        },
        product_placement_and_focus: {
          type: Type.OBJECT,
          properties: {
            primary_product_visibility: { type: Type.STRING },
            secondary_product_visibility: { type: Type.STRING },
            focus_depth: { type: Type.STRING },
          },
        },
        scene_and_environment: {
          type: Type.OBJECT,
          properties: {
            location_type: { type: Type.STRING },
            background_elements: { type: Type.ARRAY, items: { type: Type.STRING } },
            time_of_day: { type: Type.STRING },
            weather_conditions: { type: Type.STRING },
            props_in_scene: { type: Type.ARRAY, items: { type: Type.STRING } },
          },
        },
        lighting_and_color_grading: {
          type: Type.OBJECT,
          properties: {
            light_source_type: { type: Type.STRING },
            light_direction: { type: Type.STRING },
            color_palette_mood: { type: Type.STRING },
            contrast_level: { type: Type.STRING },
            saturation_level: { type: Type.STRING },
            sharpening_amount: { type: Type.STRING },
          },
        },
        video_specific_elements: {
          type: Type.OBJECT,
          properties: {
            camera_movements: { type: Type.ARRAY, items: { type: Type.STRING } },
            transition_style: { type: Type.STRING },
            editing_pacing: { type: Type.STRING },
            text_overlays_recommendations: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  text: { type: Type.STRING },
                  position: { type: Type.STRING },
                  font_style: { type: Type.STRING },
                  font_color: { type: Type.STRING },
                  bg_color: { type: Type.STRING },
                  animation: { type: Type.STRING },
                },
              },
            },
            visual_effects_suggestions: { type: Type.ARRAY, items: { type: Type.STRING } },
          },
        },
      },
    },
    audio_generation_parameters: {
      type: Type.OBJECT,
      properties: {
        voiceover: {
          type: Type.OBJECT,
          properties: {
            language: { type: Type.STRING },
            accent: { type: Type.STRING },
            tone: { type: Type.STRING },
            speaking_rate: { type: Type.STRING },
            pitch_adjustment: { type: Type.STRING },
            script_lines: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  speaker_tag: { type: Type.STRING },
                  text: { type: Type.STRING, description: "A single line of dialogue for the script. Keep it brief and conversational." },
                },
              },
            },
            custom_voice_model_id: { type: Type.STRING, description: "ID for a custom voice model, or null if not used." },
          },
        },
        background_music: {
          type: Type.OBJECT,
          properties: {
            genre: { type: Type.STRING },
            mood: { type: Type.STRING },
            intensity: { type: Type.STRING },
            volume_level: { type: Type.STRING },
            track_suggestions: { 
              type: Type.ARRAY, 
              items: { type: Type.STRING } 
            },
          },
        },
      },
    },
    marketing_and_engagement_parameters: {
      type: Type.OBJECT,
      properties: {
        call_to_action: {
          type: Type.OBJECT,
          properties: {
            type: { type: Type.STRING },
            display_text: { type: Type.STRING },
            target_url_placeholder: { type: Type.STRING },
          },
        },
        hashtags_suggestion: { type: Type.ARRAY, items: { type: Type.STRING } },
        target_audience: { type: Type.STRING },
        platform_optimization: { type: Type.ARRAY, items: { type: Type.STRING } },
      },
    },
  },
};