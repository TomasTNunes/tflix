plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.nunesnetwork.tflix"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.nunesnetwork.tflix"
        minSdk = 21
        targetSdk = 35
        // App version: bump BOTH on every release — versionName is what users
        // see; versionCode must strictly increase for Android to accept an update.
        versionCode = 1
        versionName = "1.0.0"
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            // Debug-signed so the release APK is directly sideloadable.
            // Replace with a real signing config before any Play Store upload.
            signingConfig = signingConfigs.getByName("debug")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    // Name the APKs like the Windows installer artifacts:
    //   release → tflix-android.<version>.apk
    //   debug   → tflix-android.debug.<version>.apk
    applicationVariants.all {
        outputs.all {
            val suffix = if (buildType.name == "debug") "debug.$versionName" else versionName
            (this as com.android.build.gradle.internal.api.BaseVariantOutputImpl).outputFileName =
                "tflix-android.$suffix.apk"
        }
    }
}
