import React from 'react';
import Head from 'next/head';
import Link from 'next/link';
import Image from 'next/image';

const LoginPage: React.FC = () => {
  return (
    <>
      <Head>
        <title>HRDE - Member Login</title>
        <meta name="description" content="Login to HRDE via SSO" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      
      <div className="auth-container sso-only">
        <div className="auth-modal">
          <div className="logo">
            <Image
              src="/Icons/HRDeOnAirLogo.svg"
              alt="HRDE"
              width={160}
              height={74}
              style={{ objectFit: 'contain' }}
            />
          </div>

          <div className="sso-message">
            <h2 className="form-title">SSO 로그인만 지원합니다</h2>
            <p className="sso-description">
              HRDe On Air는 단일 로그인 시스템으로 전환되었습니다. 아래 버튼을 이용해
              HRDe 대시보드로 이동한 뒤 SSO 인증을 완료해주세요.
            </p>

            <a
              href="https://live.hrdeedu.co.kr/live_made_by_andrew/_manager"
              className="onair-dashboard-button"
            >
              HRDe Dashboard
            </a>

            <p className="sso-helper">
              기존 테스트 계정은 계속하여{' '}
              <Link href="/member" className="onair-secondary-link">
                멤버 공간
              </Link>
              에서 확인할 수 있습니다.
            </p>
          </div>
        </div>
      </div>
    </>
  );
};

export default LoginPage;